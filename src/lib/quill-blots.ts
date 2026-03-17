/**
 * Registro centralizado dos blots customizados do Quill (Topic, MetadataField)
 * e do atributo Size. Usado pelo editor de modelo e pelo editor de documento.
 */
import { Quill } from 'react-quill-new';

const FONT_SIZES_PX = ['12px', '14px', '16px', '18px', '20px', '24px', '28px', '32px', '36px', '40px', '48px', '56px', '64px', '72px', '80px'];

let customBlotsRegistered = false;

export function ensureCustomBlotsRegistered(): void {
  if (customBlotsRegistered) return;

  const QuillAny = Quill as unknown as {
    import: (path: string) => unknown;
    register: (blot: unknown, scope?: unknown) => void;
  };

  const SizeClass = QuillAny.import('attributors/class/size') as { whitelist: string[] };
  SizeClass.whitelist = FONT_SIZES_PX;
  QuillAny.register(SizeClass, true);

  const BlockEmbed = QuillAny.import('blots/block/embed') as { create: () => HTMLElement };

  // Blot para Metadado (Campo Editável)
  class MetadataFieldBlot extends (BlockEmbed as unknown as new () => { create: () => HTMLElement }) {
    static blotName = 'metadataField';
    static tagName = 'div';
    static className = 'sgid-metadata-field';

    static create(value: { id?: string; title?: string; help?: string; topicId?: string; topicName?: string; parentFieldId?: string; parentFieldTitle?: string; repeatable?: boolean; planningInstruction?: string }) {
      const node = super.create() as HTMLElement;
      const id = value?.id || `field-${Date.now()}`;
      const title = value?.title || 'Campo';
      const help = value?.help || '';
      const parentFieldId = value?.parentFieldId || value?.topicId || '';
      const parentFieldTitle = value?.parentFieldTitle || value?.topicName || (parentFieldId.startsWith('cell:') ? `Célula ${parentFieldId.split(':').pop()}` : parentFieldId);
      const repeatable = value?.repeatable ?? false;
      const planningInstruction = value?.planningInstruction || '';

      node.setAttribute('contenteditable', 'false');
      node.setAttribute('data-field-id', id);
      node.setAttribute('data-field-title', title);
      node.setAttribute('data-field-help', help);
      node.setAttribute('data-parent-field-id', parentFieldId);
      if (repeatable) node.setAttribute('data-repeatable', 'true');
      if (planningInstruction) node.setAttribute('data-planning-instruction', planningInstruction);

      const header = document.createElement('div');
      header.className = 'sgid-metadata-field__header';

      const titleEl = document.createElement('div');
      titleEl.className = 'sgid-metadata-field__title';
      titleEl.innerText = title;
      header.appendChild(titleEl);

      if (repeatable) {
        const badge = document.createElement('span');
        badge.className = 'text-[9px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full ml-2 font-semibold';
        badge.innerText = 'REPETÍVEL';
        titleEl.appendChild(badge);
      }

      if (parentFieldId && !repeatable) {
        const parentTag = document.createElement('span');
        parentTag.className = 'text-[9px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full ml-2';
        parentTag.innerText = `Filho de: ${parentFieldTitle}`;
        titleEl.appendChild(parentTag);
      }

      if (help) {
        const helpEl = document.createElement('div');
        helpEl.className = 'sgid-metadata-field__help';
        helpEl.innerText = help;
        (helpEl as HTMLElement).style.fontSize = '10px';
        (helpEl as HTMLElement).style.opacity = '0.7';
        header.appendChild(helpEl);
      }

      const body = document.createElement('div');
      body.className = 'sgid-metadata-field__textarea';
      body.innerText = repeatable
        ? 'Campo dinâmico — a IA criará as instâncias necessárias ao gerar o documento.'
        : 'Digite aqui (campo editável no documento)...';

      node.appendChild(header);
      node.appendChild(body);

      return node;
    }

    static value(node: HTMLElement) {
      return {
        id: node.getAttribute('data-field-id') || '',
        title: node.getAttribute('data-field-title') || '',
        help: node.getAttribute('data-field-help') || '',
        topicId: node.getAttribute('data-topic-id') || node.getAttribute('data-parent-field-id') || '',
        parentFieldId: node.getAttribute('data-parent-field-id') || node.getAttribute('data-topic-id') || '',
        repeatable: node.getAttribute('data-repeatable') === 'true',
        planningInstruction: node.getAttribute('data-planning-instruction') || '',
      };
    }
  }

  // Blot para Tópico (Container Pastel)
  class TopicBlot extends (BlockEmbed as unknown as new () => { create: () => HTMLElement }) {
    static blotName = 'topic';
    static tagName = 'div';
    static className = 'sgid-topic';

    static create(value: { id?: string; name?: string } | string) {
      const node = super.create() as HTMLElement;
      const id = (typeof value === 'object' && value?.id) || (typeof value === 'string' ? value : '') || `topic-${Date.now()}`;
      const name = (typeof value === 'object' && value?.name) || 'Novo Tópico';

      node.setAttribute('contenteditable', 'false');
      node.setAttribute('data-topic-id', id);

      const titleEl = document.createElement('p');
      titleEl.className = 'sgid-topic-title';
      titleEl.innerText = name;
      node.appendChild(titleEl);

      return node;
    }

    static value(node: HTMLElement) {
      const titleEl = node.querySelector('.sgid-topic-title') || node.querySelector('p') as HTMLElement | null;
      const name = (titleEl as HTMLElement)?.innerText?.trim() || 'Tópico sem nome';
      return {
        id: node.getAttribute('data-topic-id') || '',
        name,
      };
    }
  }

  QuillAny.register(MetadataFieldBlot);
  QuillAny.register(TopicBlot);
  customBlotsRegistered = true;
}
