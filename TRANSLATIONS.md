# Translation Guide

Use this guide for translation tone, locale inheritance, and review checks.
`scripts/translations.config.json` is the source of truth for which locales are
required.

## Locale Structure

- `en` is the default locale.
- `ko`, `es`, `ja`, and `pt` are required complete locales.
- `en_GB`, `pt_BR`, and `pt_PT` are sparse locales. They may override only the
  messages that need regional wording.
- Manifest messages must exist in every locale because Chrome reads them
  directly from locale folders.

## Tone

- Keep UI copy concise, calm, and task-focused.
- Prefer natural product wording over literal English structure.
- Preserve technical meaning before preserving sentence shape.
- Do not add explanations that the source text does not need.
- For Korean, do not over-explain Korean, Hangul, or typing concepts that Korean
  readers are likely to already know.
- Mac key names such as Command, Option, and Control are hardware labels; keep
  them in English unless a locale already has a clear established convention.

## Locale Notes

### Portuguese

`pt` is Brazilian Portuguese and is the complete Portuguese locale. `pt_BR` is a
sparse Brazilian override, so ordinary UI messages usually fall back to `pt`.

`pt_PT` is a sparse European Portuguese override. When changing `pt`, check
whether the Brazilian wording would sound wrong for Portugal and add or update a
`pt_PT` override when needed.

Prefer these conventions:

- Brazilian Portuguese: `Pressione`, `guia`, `salvo`/`salva`, `Você`.
- European Portuguese: `Prima`, `separador`, `guardado`/`guardada`,
  `predefinição`/`predefinida`, `Também pode`, `ecrã`.

## Checklist

- Update `en` first.
- Update every required complete locale from `scripts/translations.config.json`.
- Update sparse locales when fallback wording would be regionally wrong or when
  the sparse locale already overrides the affected message.
- Run `npm run check-translations` after editing locale files.
- Run `npm run validate` before pushing.
