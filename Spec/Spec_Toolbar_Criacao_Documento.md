# Spec: Barra de Ferramentas da Tela de Criação de Documento

**Modelo de referência.** Este documento descreve a barra de ferramentas do `DocumentEditor` (tela de criação/edição de documento). Não alterar o componente sem solicitação explícita do usuário.

---

## Localização

- **Componente:** `src/app/components/DocumentEditor.tsx`
- **Visibilidade:** Apenas quando `editorMode === 'text'` (modo Editor, não HTML)
- **Layout:** Flutuante fixa na parte inferior central (`sgid-floating-toolbar`)

---

## Ferramentas (ordem)

1. **Tamanho da fonte** — Select "Normal" + opções em px (12px a 80px)
2. **Negrito** — `ql-bold`
3. **Itálico** — `ql-italic`
4. **Sublinhado** — `ql-underline`
5. **Riscado** — `ql-strike`
6. **Cor do texto** — Popover com HexColorPicker + ícone Palette
7. **Alinhamento** — Select ql-align (Esquerda, Centro, Direita, Justificar)
8. **Link** — `ql-link`
9. **Citação** — `ql-blockquote`
10. **Limpar formatação** — `ql-clean`

---

## Ícones SVG (QUILL_ICONS)

Os ícones são embutidos nos botões via `dangerouslySetInnerHTML` para ficarem visíveis ao entrar na página (antes de focar no editor).

- bold, italic, underline, strike, link, blockquote, clean
- Classes Quill: `ql-stroke`, `ql-fill`, `ql-even`, `ql-thin`

---

## Classes CSS principais

- **Container:** `sgid-floating-toolbar shadow-2xl print:hidden`
- **Toolbar interna:** `ql-toolbar ql-snow flex flex-row items-center flex-nowrap border-none bg-transparent`
- **Formats:** `ql-formats flex items-center flex-shrink-0`
- **Editor wrapper:** `doc-editor-quill` (overflow, word-wrap para texto não vazar)

---

## Dependências

- `toolbarId` — ID único para o container (`#doc-editor-toolbar-*`)
- `quillModules` — `{ toolbar: { container: \`#${toolbarId}\` } }`
- `activeQuillRef` — Referência ao ReactQuill da seção ativa
- Estados: `fontSize`, `fontColor`, `colorPickerOpen`

---

## Regra

**Não alterar** o `DocumentEditor` ou a barra de ferramentas sem solicitação explícita do usuário.
