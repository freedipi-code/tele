// ───────────────────────────────────────────────────────────────────
// SHOP BRANDING CONFIG
// Edit this file to customize your shop's identity (name, shipping policy,
// channel link, owner username, footer signature, etc.).
// No need to touch any other file in the project.
// ───────────────────────────────────────────────────────────────────

module.exports = {
  // Display name shown in welcome message header
  name: "DANK OF WALES",

  // Emoji prepended/appended to the shop name in welcome
  emoji: "◆",

  // Shipping policy line (1-2 short lines max)
  shippingLine: "🇬🇧 Uk Shipping",
  dispatchLine: "⏰ All purchases made before 1pm are dispatched the same day fast and reliable delivery",

  // Bulk enquiries line
  bulkLine: "🎫 For bulk enquiries, please open a ticket  Select an option below to get started",

  // Channel / community
  channelUrl: "https://t.me/Dankofwales0",            // e.g. "https://t.me/your_channel" — empty hides the button
  channelLabel: "Join our Channel",

  // Owner / support contact (Telegram username without @)
  ownerUsername: "",         // e.g. "yourhandle" — empty hides the line
  ownerStatusLine: "🟢 Online",  // overridden if you want dynamic status later

  // Footer
  footerLink: "https://t.me/dankofwales0bot",
  footerText: "Powered by Dank of Wales",

  // Welcome cover image (path to local file OR public URL OR empty for text-only)
  // Examples:
  //   "assets/welcome.jpg"
  //   "https://yourcdn.com/cover.jpg"
  welcomeImage: "images/welcome.jpg",

  // Information page content (shown when user clicks ℹ️ Information)
  information: [
    "📦 *Shipping*",
    "All orders placed before 1pm are dispatched the same day.",
    "Worldwide shipping available.",
    "",
    "💳 *Payment*",
    "We accept BTC and LTC.",
    "Payment instructions are shown after checkout.",
    "",
    "↩️ *Returns*",
    "14-day return policy on unopened items.",
    "Contact support for return instructions.",
    "",
    "🔒 *Privacy*",
    "Your shipping address is used only for delivery and is never shared.",
  ].join("\n"),
};
