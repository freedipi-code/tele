/**
 * Sync local SQLite data (prisma/dev.db) to the remote PostgreSQL DATABASE_URL.
 *
 * Usage:
 *   node scripts/sync-local-to-remote.js
 */
require('dotenv').config();

const { execFileSync } = require('child_process');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const dbPath = path.join(__dirname, '..', 'prisma', 'dev.db');

function readTable(table, orderBy = 'id') {
  const sql = `SELECT * FROM "${table}" ORDER BY "${orderBy}"`;
  const output = execFileSync('sqlite3', ['-json', dbPath, sql], {
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 20,
  }).trim();

  return output ? JSON.parse(output) : [];
}

function toDate(value) {
  if (!value) return undefined;
  if (typeof value === 'number') return new Date(value);
  return new Date(value);
}

async function createWithPreferredId(model, data) {
  try {
    return await model.create({ data });
  } catch (error) {
    if (error.code !== 'P2002' || !error.meta?.target?.includes('id')) {
      throw error;
    }

    const { id, ...withoutId } = data;
    return model.create({ data: withoutId });
  }
}

async function resetPostgresSequences() {
  const tables = ['User', 'Category', 'Product', 'Cart', 'CartItem', 'Order', 'OrderItem'];

  for (const table of tables) {
    await prisma.$executeRawUnsafe(`
      SELECT setval(
        pg_get_serial_sequence('"${table}"', 'id'),
        COALESCE((SELECT MAX("id") FROM "${table}"), 1),
        (SELECT COUNT(*) FROM "${table}") > 0
      )
    `);
  }
}

async function removeRemoteCatalogRowsMissingLocally(data) {
  const localCategoryIds = data.categories.map((category) => category.id);
  const localProductIds = data.products.map((product) => product.id);

  const removedProducts = await prisma.product.deleteMany({
    where: { id: { notIn: localProductIds } },
  });

  const extraCategories = await prisma.category.findMany({
    where: { id: { notIn: localCategoryIds } },
    orderBy: { id: 'desc' },
    select: { id: true },
  });

  for (const category of extraCategories) {
    await prisma.category.delete({ where: { id: category.id } });
  }

  if (removedProducts.count || extraCategories.length) {
    console.log(`\nRemoved remote-only catalog rows:`);
    console.log(`  products: ${removedProducts.count}`);
    console.log(`  categories: ${extraCategories.length}`);
  }
}

async function main() {
  const data = {
    users: readTable('User'),
    categories: readTable('Category'),
    products: readTable('Product'),
    carts: readTable('Cart'),
    cartItems: readTable('CartItem'),
    orders: readTable('Order'),
    orderItems: readTable('OrderItem'),
  };

  console.log('Local SQLite data:');
  for (const [name, rows] of Object.entries(data)) {
    console.log(`  ${name}: ${rows.length}`);
  }

  if (process.env.SKIP_CATALOG !== '1') {
    for (const category of data.categories.filter((c) => !c.parentId)) {
      await prisma.category.upsert({
        where: { id: category.id },
        update: { name: category.name, parentId: null },
        create: { id: category.id, name: category.name, parentId: null },
      });
    }

    for (const category of data.categories.filter((c) => c.parentId)) {
      await prisma.category.upsert({
        where: { id: category.id },
        update: { name: category.name, parentId: category.parentId },
        create: { id: category.id, name: category.name, parentId: category.parentId },
      });
    }

    for (const product of data.products) {
      await prisma.product.upsert({
        where: { id: product.id },
        update: {
          name: product.name,
          price: product.price,
          image: product.image,
          description: product.description,
          stock: product.stock,
          active: Boolean(product.active),
          categoryId: product.categoryId,
        },
        create: {
          id: product.id,
          name: product.name,
          price: product.price,
          image: product.image,
          description: product.description,
          stock: product.stock,
          active: Boolean(product.active),
          categoryId: product.categoryId,
        },
      });
    }
  } else {
    console.log('\nSkipping catalog sync because SKIP_CATALOG=1');
  }

  const userIdMap = {};
  const cartIdMap = {};

  for (const user of data.users) {
    const userData = {
      id: user.id,
      telegramId: user.telegramId,
      username: user.username,
      fullName: user.fullName,
      createdAt: toDate(user.createdAt),
    };

    const existing = await prisma.user.findUnique({
      where: { telegramId: user.telegramId },
      select: { id: true },
    });

    const synced = existing
      ? await prisma.user.update({
          where: { id: existing.id },
          data: {
            username: user.username,
            fullName: user.fullName,
            createdAt: toDate(user.createdAt),
          },
        })
      : await createWithPreferredId(prisma.user, userData);

    userIdMap[user.id] = synced.id;
  }

  for (const cart of data.carts) {
    const remoteUserId = userIdMap[cart.userId];
    if (!remoteUserId) continue;

    const existing = await prisma.cart.findUnique({
      where: { userId: remoteUserId },
      select: { id: true },
    });

    const synced = existing
      ? await prisma.cart.update({
        where: { id: existing.id },
        data: { updatedAt: toDate(cart.updatedAt) },
      })
      : await createWithPreferredId(prisma.cart, {
        id: cart.id,
        userId: remoteUserId,
        updatedAt: toDate(cart.updatedAt),
      });

    cartIdMap[cart.id] = synced.id;
  }

  for (const cartItem of data.cartItems) {
    const remoteCartId = cartIdMap[cartItem.cartId];
    if (!remoteCartId) continue;

    await prisma.cartItem.upsert({
        where: {
          cartId_productId: {
            cartId: remoteCartId,
            productId: cartItem.productId,
          },
        },
        update: { quantity: cartItem.quantity },
        create: {
          id: cartItem.id,
          cartId: remoteCartId,
          productId: cartItem.productId,
          quantity: cartItem.quantity,
        },
    });
  }

  for (const order of data.orders) {
    const existing = await prisma.order.findUnique({
        where: { orderNumber: order.orderNumber },
        select: { id: true },
      });

      const orderData = {
        id: order.id,
        orderNumber: order.orderNumber,
        userId: userIdMap[order.userId],
        total: order.total,
        paymentMethod: order.paymentMethod === 'USDT' ? 'LTC' : order.paymentMethod,
        status: order.status,
        fullName: order.fullName,
        address: order.address,
        notes: order.notes,
        proofMessage: order.proofMessage,
        createdAt: toDate(order.createdAt),
      };

    if (existing) {
      await prisma.order.update({
          where: { id: existing.id },
          data: {
            total: orderData.total,
            paymentMethod: orderData.paymentMethod,
            status: orderData.status,
            fullName: orderData.fullName,
            address: orderData.address,
            notes: orderData.notes,
            proofMessage: orderData.proofMessage,
            createdAt: orderData.createdAt,
          },
      });
    } else {
      const items = data.orderItems.filter((item) => item.orderId === order.id);
      await prisma.order.create({
          data: {
            ...orderData,
            items: {
              create: items.map((item) => ({
                id: item.id,
                productId: item.productId,
                quantity: item.quantity,
                price: item.price,
              })),
            },
          },
      });
    }
  }

  if (process.env.SKIP_CATALOG !== '1') {
    await removeRemoteCatalogRowsMissingLocally(data);
  }
  await resetPostgresSequences();

  console.log('\nRemote PostgreSQL counts:');
  console.log(`  users: ${await prisma.user.count()}`);
  console.log(`  categories: ${await prisma.category.count()}`);
  console.log(`  products: ${await prisma.product.count()}`);
  console.log(`  carts: ${await prisma.cart.count()}`);
  console.log(`  cartItems: ${await prisma.cartItem.count()}`);
  console.log(`  orders: ${await prisma.order.count()}`);
  console.log(`  orderItems: ${await prisma.orderItem.count()}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
