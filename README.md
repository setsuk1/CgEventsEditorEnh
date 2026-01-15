# CG Events Editor

專為編輯 Code.Gamelet `.events` 檔案的 VS Code 編輯器，提供視覺化編輯與 JSON 模式。

## 功能

- **Schema 驅動編輯**：掃描工作區內的 `events.schema.json`（Enh/EnhFF/自訂分支），合併後生成基礎設定、觸發、檢查與動作 UI。
- **視覺化 / JSON 切換**：表單與原始 JSON 同步，JSON 模式支援驗證與錯誤提示。
- **事件排序**：支援排序規則與預設管理。
- **事件資料夾**：用於篩選要顯示的事件。
- **觸發/檢查/動作庫**：提供搜尋、麵包屑導覽與歷史返回。
- **表單歷史**：Undo/Redo（`Ctrl+Z` / `Ctrl+Y`）。
- **LZString 支援**：可編解碼 `.events` 的壓縮內容（base64 + `/*lz*/`）。
- **一鍵跳轉**：可直接從 VS Code 開啟 Code.Gamelet 線上事件編輯器。

## 使用方式

1. 安裝並啟用擴充套件。
2. 開啟 `.events` 檔案，啟用 `CG Events Editor` 自訂編輯器。

## Commands

- `Open Events File as JSON (Enh)`：以 JSON 模式開啟 `.events` 檔案。
- `Create Events File With Template (Enh)`：以範本建立新的 `.events` 檔案。

## Settings

- `cgeventseditorenh.language`：UI 語言（`auto` / `en-US` / `zh-Hant` / `zh-Hans` / `ja` / `ko`）。
- `cgeventseditorenh.syncLanguage`：語言同步策略（`auto` / `ask` / `none`）。
- `cgeventseditorenh.sortingPresets`：事件排序預設（名稱對應排序規則陣列）。

## Requirements

- VS Code `^1.106.0`

## 開發

```bash
npm install
npm run compile   # type check + lint + build
npm run watch     # watch tsc/esbuild
npm run package   # production build
```

使用 VS Code 的 `Run Extension` 啟動除錯。

## 使用工具/函式庫

- [React](https://react.dev/)
- [RJSF json form](https://github.com/rjsf-team/react-jsonschema-form)
- [bootstrap](https://getbootstrap.com/)
- [lz-string](https://github.com/pieroxy/lz-string)
- [mathjs](https://mathjs.org/)
- [monaco-editor](https://github.com/microsoft/monaco-editor)
- [Codex](https://chatgpt.com/codex/)
- [Claude code](https://claude.ai)

## Assets

- Image and audio assets source: https://code.gamelet.com/profile/Haskasu/assets
