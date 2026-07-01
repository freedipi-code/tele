const { homeMenu } = require('../keyboards');
const shop = require('../../shop.config');
const { resolveImage } = require('../../utils/image');

function buildWelcomeText() {
  const lines = [
    '◆ DANK OF WALES',
    '▬▬▬▬▬▬▬▬▬▬▬▬',
    '🪙 BTC, LTC',
    '⭐ 4.9/5',
    '🧾 378 sales',
    '📦 Not set',
    '▬▬▬▬▬▬▬▬▬▬▬▬',
    '🔗 Linked chanel account: @Dankofwales0',
    '🔒 Verification phrase not set yet',
    '▬▬▬▬▬▬▬▬▬▬▬▬',
    'Compare this phrase across legit shop bots and your signed-in web account.',
  ];
  return lines.join('\n');
}

async function showHome(ctx) {
  const text = buildWelcomeText();
  const opts = {
    parse_mode: 'Markdown',
    disable_web_page_preview: false,
    ...homeMenu(),
  };

  const photoSrc = resolveImage(shop.welcomeImage);

  if (ctx.callbackQuery) {
    await ctx.answerCbQuery().catch(() => {});
    try {
      if (photoSrc) {
        await ctx.editMessageCaption(text, opts);
      } else {
        await ctx.editMessageText(text, opts);
      }
      return;
    } catch (_) {
      // fallback below (e.g. message type mismatch)
    }
  }

  if (photoSrc) {
    try {
      await ctx.replyWithPhoto(photoSrc, { caption: text, ...opts });
      return;
    } catch (_) {
      // fallback to text-only if image fails
    }
  }
  await ctx.reply(text, opts);
}

const HELP_TEXT = [
  '*Available commands*',
  '',
  '/start — Show the home menu',
  '/menu — Same as /start',
  '/shop — Browse the shop',
  '/cart — View your cart',
  '/orders — View your past orders',
  '/info — Information (shipping, payment, returns)',
  '/support — Contact support',
  '/help — Show this list',
].join('\n');

async function showHelp(ctx) {
  await ctx.reply(HELP_TEXT, { parse_mode: 'Markdown' });
}

function register(bot) {
  bot.start((ctx) => showHome(ctx));
  bot.command('menu', (ctx) => showHome(ctx));
  bot.command('help', (ctx) => showHelp(ctx));
  bot.action('home', (ctx) => showHome(ctx));
}

module.exports = { register, showHome };
