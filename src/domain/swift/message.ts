// legacy: PV.Core/SwiftMessage.cs - FIN block-4 fields and messages.
import { csTrim } from '../dotnet';

/** legacy: SwiftField. `raw` keeps the qualifier text as sent plus `\n`-joined continuation lines. */
export class SwiftField {
  constructor(readonly tag: string, public raw: string) {}

  /** value after the first `//`, trimmed; whole raw text trimmed otherwise */
  get content(): string {
    const i = this.raw.indexOf('//');
    return i < 0 ? csTrim(this.raw) : csTrim(this.raw.slice(i + 2));
  }

  /** text between an optional leading `:` and `//`, or null */
  get qualifier(): string | null {
    const s = this.raw.startsWith(':') ? this.raw.slice(1) : this.raw;
    const i = s.indexOf('//');
    return i < 0 ? null : s.slice(0, i);
  }
}

/** legacy: SwiftMessage */
export class SwiftMessage {
  mtType = 0;
  senderLT: string | null = null;
  readonly fields: SwiftField[] = [];
  fileName: string | null = null;

  find(tag: string): SwiftField | null {
    return this.fields.find(f => f.tag === tag) ?? null;
  }

  findAll(tag: string): SwiftField[] {
    return this.fields.filter(f => f.tag === tag);
  }

  /** fields between `16R:<id>` and `16S:<id>`; nested sub-blocks are flattened (Q5) */
  blocks(blockId: string): SwiftField[][] {
    const blocks: SwiftField[][] = [];
    let cur: SwiftField[] | null = null;
    for (const f of this.fields) {
      if (f.tag === '16R' && csTrim(f.raw) === blockId) {
        cur = [];
        blocks.push(cur);
      } else if (f.tag === '16S' && csTrim(f.raw) === blockId) {
        cur = null;
      } else if (cur) {
        cur.push(f);
      }
    }
    return blocks;
  }
}
