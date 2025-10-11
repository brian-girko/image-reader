export class DoclingConverter {
  constructor() {
    this.simpleTagMap = {
      doctag: "div",
      document: "div",
      ordered_list: "ol",
      unordered_list: "ul",
      list_item: "li",
      caption: "figcaption",
      footnote: "sup",
      formula: "div",
      page_footer: "footer",
      page_header: "header",
      picture: "figure",
      chart: "figure",
      table: "table",
      otsl: "table",
      text: "p",
      paragraph: "p",
      title: "h1",
      document_index: "div",
      form: "form",
      key_value_region: "dl",
      reference: "a",
      smiles: "span",
    };
    this.selfClosingTagMap = {
      checkbox_selected: '<input type="checkbox" checked disabled>',
      checkbox_unselected: '<input type="checkbox" disabled>',
      page_break: '<hr class="page-break">',
    };
    this.TABLE_TAG_CONFIG = {
      "<ched>": { htmlTag: "th" },
      "<rhed>": { htmlTag: "th", scope: "row" },
      "<srow>": { htmlTag: "th", scope: "row" },
      "<fcel>": { htmlTag: "td" },
      "<ecel>": { htmlTag: "td" },
      "<ucel>": { htmlTag: "td" },
      "<lcel>": { htmlTag: "td" },
      "<xcel>": { htmlTag: "td" },
    };
    this.TABLE_TAG_REGEX = new RegExp(`(${Object.keys(this.TABLE_TAG_CONFIG).join("|")})`);
    const selfClosingNames = Object.keys(this.selfClosingTagMap).join("|");
    this.combinedTagRegex = new RegExp(`(<([a-z_0-9]+)>(.*?)<\\/\\2>)|(<(${selfClosingNames})>)`, "s");
  }
  escapeHtml(text) {
    if (!text) return "";
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  convert(docling) {
    let html = ` ${docling} `;
    html = this.cleanupMetadataTokens(html);
    html = this.processTags(html);
    return html.trim();
  }
  processTags(text) {
    let remainingText = text;
    let result = "";
    while (remainingText.length > 0) {
      const match = remainingText.match(this.combinedTagRegex);
      if (match && typeof match.index === "number") {
        const textBefore = remainingText.substring(0, match.index);
        result += this.escapeHtml(textBefore);
        const fullMatch = match[0];
        const pairedTagName = match[2];
        const pairedContent = match[3];
        const selfClosingTagName = match[5];
        if (pairedTagName !== undefined) {
          result += this.convertSingleTag(pairedTagName, pairedContent);
        } else if (selfClosingTagName !== undefined) {
          result += this.selfClosingTagMap[selfClosingTagName] || "";
        }
        remainingText = remainingText.substring(match.index + fullMatch.length);
      } else {
        result += this.escapeHtml(remainingText);
        break;
      }
    }
    return result;
  }
  convertSingleTag(tagName, content) {
    if (tagName === "list_item") {
      content = content.trim().replace(/^[·-]\s*/g, "");
    }
    switch (tagName) {
      case "code":
        return this.convertBlockCode(content);
      case "otsl":
        return this.convertTable(content);
      case "picture":
      case "chart":
        return this.convertPictureOrChart(tagName, content);
      case "inline":
        return this.convertInlineContent(content);
      case "section_header_level_0":
      case "section_header_level_1":
      case "section_header_level_2":
      case "section_header_level_3":
      case "section_header_level_4":
      case "section_header_level_5":
        const level = parseInt(tagName.at(-1), 10) + 1;
        return `<h${level}>${this.processTags(content)}</h${level}>`;
      default:
        const htmlTag = this.simpleTagMap[tagName];
        if (htmlTag) {
          const processedContent = this.processTags(content);
          const startTag = this.getStartTag(tagName, htmlTag);
          return `${startTag}${processedContent}</${htmlTag}>`;
        }
        console.warn(`Unknown tag encountered: ${tagName}, escaping it.`);
        return this.escapeHtml(`<${tagName}>${content}</${tagName}>`);
    }
  }
  getStartTag(doclingTag, htmlTag) {
    switch (doclingTag) {
      case "doctag":
      case "document":
        return '<div class="docling-document">';
      case "formula":
        return '<div class="formula">';
      case "document_index":
        return '<div class="toc">';
      case "smiles":
        return '<span class="smiles">';
      case "reference":
        return '<a href="#">';
      default:
        return `<${htmlTag}>`;
    }
  }
  convertInlineContent(content) {
    const inlineTagRegex = /<(code|formula|text|smiles)>(.*?)<\/\1>/s;
    let remainingText = content;
    let result = "";
    while (remainingText.length > 0) {
      const match = remainingText.match(inlineTagRegex);
      if (match && typeof match.index === "number") {
        const textBefore = remainingText.substring(0, match.index);
        result += this.escapeHtml(textBefore);
        const [fullMatch, tagName, innerContent] = match;
        switch (tagName) {
          case "code":
            const langRegex = /<_(.*?)_>/;
            const langMatch = innerContent.match(langRegex);
            if (langMatch && langMatch[1]) {
              const language = this.sanitizeLanguageName(langMatch[1]);
              const codeContent = innerContent.replace(langRegex, "").trim();
              const escapedCode = this.escapeHtml(codeContent);
              const langClass = language !== "unknown" ? ` class="language-${language}"` : "";
              result += `<code${langClass}>${escapedCode}</code>`;
            } else {
              result += `<code>${this.escapeHtml(innerContent)}</code>`;
            }
            break;
          case "formula":
            result += `<span class="formula">${this.escapeHtml(innerContent)}</span>`;
            break;
          case "smiles":
            result += `<span class="smiles">${this.escapeHtml(innerContent)}</span>`;
            break;
          case "text":
            result += this.escapeHtml(innerContent);
            break;
        }
        remainingText = remainingText.substring(match.index + fullMatch.length);
      } else {
        result += this.escapeHtml(remainingText);
        break;
      }
    }
    return result;
  }
  convertBlockCode(content) {
    const langRegex = /<_(.*?)_>/;
    const langMatch = content.match(langRegex);
    let language = "unknown";
    let codeContent = content;
    if (langMatch && langMatch[1]) {
      language = this.sanitizeLanguageName(langMatch[1]);
      codeContent = content.replace(langRegex, "").trim();
    }
    const escapedCode = this.escapeHtml(codeContent);
    const langClass = language !== "unknown" ? ` class="language-${language}"` : "";
    return `<pre><code${langClass}>${escapedCode}</code></pre>`;
  }
  convertTable(content) {
    const rows = content
      .trim()
      .split(/<nl>/)
      .filter((row) => row.length > 0);
    const cellGrid = [];
    rows.forEach((rowStr, rowIndex) => {
      var _a;
      const parts = rowStr.split(this.TABLE_TAG_REGEX);
      const currentRow = [];
      let gridColIndex = 0;
      for (let i = 1; i < parts.length; i += 2) {
        const tag = parts[i];
        const cellContent = parts[i + 1] || "";
        switch (tag) {
          case "<lcel>":
            if (currentRow.length > 0) {
              currentRow[currentRow.length - 1].colspan++;
            }
            break;
          case "<ucel>":
            if (rowIndex > 0 && ((_a = cellGrid[rowIndex - 1]) === null || _a === void 0 ? void 0 : _a[gridColIndex])) {
              cellGrid[rowIndex - 1][gridColIndex].rowspan++;
            }
            gridColIndex++;
            break;
          case "<xcel>":
            if (currentRow.length > 0) {
              currentRow[currentRow.length - 1].colspan++;
            }
            break;
          default:
            if (this.TABLE_TAG_CONFIG[tag]) {
              currentRow.push({
                content: cellContent,
                tag,
                colspan: 1,
                rowspan: 1,
              });
              gridColIndex++;
            }
            break;
        }
      }
      cellGrid.push(currentRow);
    });
    const htmlRows = cellGrid
      .map((row) => {
        const cellsHtml = row
          .map((cell) => {
            const config = this.TABLE_TAG_CONFIG[cell.tag];
            if (!config) return "";
            const attrs = [];
            if (cell.colspan > 1) attrs.push(`colspan="${cell.colspan}"`);
            if (cell.rowspan > 1) attrs.push(`rowspan="${cell.rowspan}"`);
            if (config.scope) attrs.push(`scope="${config.scope}"`);
            const processedContent = this.processTags(cell.content);
            const attrString = attrs.length > 0 ? ` ${attrs.join(" ")}` : "";
            return `<${config.htmlTag}${attrString}>${processedContent}</${config.htmlTag}>`;
          })
          .join("");
        return `<tr>${cellsHtml}</tr>`;
      })
      .join("");
    return `<table><tbody>${htmlRows}</tbody></table>`;
  }
  convertPictureOrChart(tag, content) {
    if (/<(fcel|ched|rhed)>/.test(content)) {
      const cleanedContent = content.replace(/<[a-z_]+>/g, (match) => {
        if (match.startsWith("<fcel") || match.startsWith("<ched") || match.startsWith("<rhed") || match.startsWith("<nl")) {
          return match;
        }
        return "";
      });
      return this.convertTable(cleanedContent);
    }
    let captionHtml = "";
    const captionRegex = /<caption>(.*?)<\/caption>/s;
    const captionMatch = content.match(captionRegex);
    if (captionMatch && captionMatch[1]) {
      const captionContent = this.processTags(captionMatch[1]);
      captionHtml = `<figcaption>${captionContent}</figcaption>`;
    }
    const contentWithoutCaption = content.replace(captionRegex, "");
    const classificationRegex = /<([a-z_]+)>/;
    const classMatch = contentWithoutCaption.match(classificationRegex);
    let altText = tag;
    if (classMatch) {
      altText = classMatch[1].replace(/_/g, " ");
    }
    const imgHtml = `<img alt="${this.escapeHtml(altText)}" src="">`;
    const figureTag = this.simpleTagMap[tag] || "figure";
    return `<${figureTag}>${imgHtml}${captionHtml}</${figureTag}>`;
  }
  sanitizeLanguageName(lang) {
    const lowerLang = lang.toLowerCase();
    const aliasMap = {
      "c#": "csharp",
      "c++": "cpp",
      objectivec: "objective-c",
      visualbasic: "vb",
      javascript: "js",
      typescript: "ts",
      python: "py",
      ruby: "rb",
      dockerfile: "docker",
    };
    return aliasMap[lowerLang] || lowerLang.replace(/[\s#+]/g, "-");
  }
  cleanupMetadataTokens(docling) {
    return docling.replace(/<loc_[0-9]+>/g, "");
  }
}

export function doclingToHtml(docling) {
  const converter = new DoclingConverter();
  return converter.convert(docling);
}
