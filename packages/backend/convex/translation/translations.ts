import { mutation, query } from "../_generated/server"
import { ConvexError, v } from "convex/values"

// Default translations for the widget
export const DEFAULT_TRANSLATIONS: Record<string, Record<string, string>> = {
  en: {
    "widget.greeting": "Hi there! 👋",
    "widget.subtitle": "Let's get you started.",
    "widget.startChat": "Start Chat",
    "widget.inbox": "Inbox",
    "widget.contact": "Contact Us",
    "widget.back": "Back",
    "widget.send": "Send",
    "widget.typeMessage": "Type your message...",
    "widget.conversationEnded": "Conversation ended",
    "widget.loading": "Loading...",
    "widget.error": "Something went wrong. Please try again later.",
    "auth.name": "Name",
    "auth.email": "Email",
    "auth.phone": "Phone",
    "auth.continue": "Continue",
    "auth.enterName": "Enter your name",
    "auth.enterEmail": "Enter your email",
    "contact.title": "Contact Us",
    "contact.message": "Message",
    "contact.sendMessage": "Send Message",
    "contact.success": "Message Sent!",
    "contact.successMessage":
      "Thank you for reaching out. We'll get back to you as soon as possible.",
    "inbox.empty": "No conversations yet",
    "inbox.startNew": "Start a new conversation",
  },
  es: {
    "widget.greeting": "¡Hola! 👋",
    "widget.subtitle": "Empecemos.",
    "widget.startChat": "Iniciar Chat",
    "widget.inbox": "Bandeja de entrada",
    "widget.contact": "Contáctanos",
    "widget.back": "Volver",
    "widget.send": "Enviar",
    "widget.typeMessage": "Escribe tu mensaje...",
    "widget.conversationEnded": "Conversación terminada",
    "widget.loading": "Cargando...",
    "widget.error": "Algo salió mal. Por favor, inténtalo de nuevo más tarde.",
    "auth.name": "Nombre",
    "auth.email": "Correo electrónico",
    "auth.phone": "Teléfono",
    "auth.continue": "Continuar",
    "auth.enterName": "Ingresa tu nombre",
    "auth.enterEmail": "Ingresa tu correo",
    "contact.title": "Contáctanos",
    "contact.message": "Mensaje",
    "contact.sendMessage": "Enviar Mensaje",
    "contact.success": "¡Mensaje Enviado!",
    "contact.successMessage":
      "Gracias por comunicarte. Te responderemos lo antes posible.",
    "inbox.empty": "No hay conversaciones aún",
    "inbox.startNew": "Iniciar una nueva conversación",
  },
  fr: {
    "widget.greeting": "Bonjour! 👋",
    "widget.subtitle": "Commençons.",
    "widget.startChat": "Démarrer le chat",
    "widget.inbox": "Boîte de réception",
    "widget.contact": "Nous contacter",
    "widget.back": "Retour",
    "widget.send": "Envoyer",
    "widget.typeMessage": "Tapez votre message...",
    "widget.conversationEnded": "Conversation terminée",
    "widget.loading": "Chargement...",
    "widget.error":
      "Quelque chose s'est mal passé. Veuillez réessayer plus tard.",
    "auth.name": "Nom",
    "auth.email": "Email",
    "auth.phone": "Téléphone",
    "auth.continue": "Continuer",
    "auth.enterName": "Entrez votre nom",
    "auth.enterEmail": "Entrez votre email",
    "contact.title": "Nous contacter",
    "contact.message": "Message",
    "contact.sendMessage": "Envoyer le message",
    "contact.success": "Message envoyé!",
    "contact.successMessage":
      "Merci de nous avoir contactés. Nous vous répondrons dès que possible.",
    "inbox.empty": "Pas encore de conversations",
    "inbox.startNew": "Démarrer une nouvelle conversation",
  },
  de: {
    "widget.greeting": "Hallo! 👋",
    "widget.subtitle": "Lass uns anfangen.",
    "widget.startChat": "Chat starten",
    "widget.inbox": "Posteingang",
    "widget.contact": "Kontakt",
    "widget.back": "Zurück",
    "widget.send": "Senden",
    "widget.typeMessage": "Nachricht eingeben...",
    "widget.conversationEnded": "Gespräch beendet",
    "widget.loading": "Laden...",
    "widget.error":
      "Etwas ist schiefgelaufen. Bitte versuche es später erneut.",
    "auth.name": "Name",
    "auth.email": "E-Mail",
    "auth.phone": "Telefon",
    "auth.continue": "Weiter",
    "auth.enterName": "Name eingeben",
    "auth.enterEmail": "E-Mail eingeben",
    "contact.title": "Kontakt",
    "contact.message": "Nachricht",
    "contact.sendMessage": "Nachricht senden",
    "contact.success": "Nachricht gesendet!",
    "contact.successMessage":
      "Vielen Dank für Ihre Nachricht. Wir melden uns so schnell wie möglich.",
    "inbox.empty": "Noch keine Gespräche",
    "inbox.startNew": "Neues Gespräch starten",
  },
}

// Get translations for a locale
export const getTranslations = query({
  args: {
    organizationId: v.string(),
    locale: v.string(),
  },
  handler: async (ctx, args) => {
    // Get custom translations from database
    const customTranslations = await ctx.db
      .query("translations")
      .withIndex("by_organization_and_locale", (q) =>
        q.eq("organizationId", args.organizationId).eq("locale", args.locale),
      )
      .collect()

    // Start with default translations
    const defaultForLocale =
      DEFAULT_TRANSLATIONS[args.locale] || DEFAULT_TRANSLATIONS["en"]

    // Merge with custom translations
    const merged = { ...defaultForLocale }
    customTranslations.forEach((t) => {
      merged[t.key] = t.value
    })

    return merged
  },
})

// Set a custom translation
export const setTranslation = mutation({
  args: {
    organizationId: v.string(),
    locale: v.string(),
    key: v.string(),
    value: v.string(),
  },
  handler: async (ctx, args) => {
    // Check if translation already exists
    const existing = await ctx.db
      .query("translations")
      .withIndex("by_key_and_locale", (q) =>
        q
          .eq("key", args.key)
          .eq("locale", args.locale)
          .eq("organizationId", args.organizationId),
      )
      .first()

    if (existing) {
      await ctx.db.patch(existing._id, { value: args.value })
      return existing._id
    }

    return await ctx.db.insert("translations", {
      organizationId: args.organizationId,
      locale: args.locale,
      key: args.key,
      value: args.value,
    })
  },
})

// Get available locales
export const getAvailableLocales = query({
  args: {},
  handler: async () => {
    return Object.keys(DEFAULT_TRANSLATIONS)
  },
})

// Bulk set translations
export const bulkSetTranslations = mutation({
  args: {
    organizationId: v.string(),
    locale: v.string(),
    translations: v.array(
      v.object({
        key: v.string(),
        value: v.string(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    for (const { key, value } of args.translations) {
      const existing = await ctx.db
        .query("translations")
        .withIndex("by_key_and_locale", (q) =>
          q
            .eq("key", key)
            .eq("locale", args.locale)
            .eq("organizationId", args.organizationId),
        )
        .first()

      if (existing) {
        await ctx.db.patch(existing._id, { value })
      } else {
        await ctx.db.insert("translations", {
          organizationId: args.organizationId,
          locale: args.locale,
          key,
          value,
        })
      }
    }
  },
})
