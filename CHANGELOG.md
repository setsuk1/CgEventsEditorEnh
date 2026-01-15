# Change Log

All notable changes to the "cgeventseditorenh" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [0.0.1]
### Added
- Help 選單新增「Open Online Editor」，可帶專案代碼直開 Code.Gamelet 事件表編輯器。
- UI 操作音效（hover/press）與音量/靜音控制。
- CheckboxList 勾選清單小工具，支援分組/全選/收合，來源/資源欄位改用新格式。
- 補上淺色模式配色。
- 事件清單採用 Lazy Loading，大幅提升大量事件時的效能。
- RJSF 物件/陣列可折疊標題。
- 支援 suggest keyboard<*>。

### Changed
- 專案名稱更改為 cgeventseditorenh
- 排序預設改由編輯器內部管理並自動同步 VS Code 設定，覆寫/刪除改用自訂確認視窗。
- 表單提交流程改為 blur/Enter 取最新表單資料並 onBlur 驗證，JSON/視覺表單切換更穩定。
- Schema 轉換與表單佈局處理強化（definition 參照、重複欄位去重、uniqueItems/indent/折疊支援）。
- README 更新：補充 Commands/Settings/Requirements 與資源來源。
- propertyOrder 排序邏輯集中至 schemaPropertyHelper 統一處理。
- 字串欄位改進：emptyValue 正確處理空值輸入，必填字串欄位加入 minLength 驗證。
- 擴充套件 ID 與 schema 預設值對齊。
- 事件工具列與導覽列動畫同步。

### Bug fixed
- 修正使用範本建立事件指令的問題。
- 修正事件編輯器拖曳行為與 RJSF 歷史記錄處理。
- 修正事件清單 body-scroll 穩定性問題。
- 修正 RJSF 布林值變更與縮排溢出問題。
- 修正 RJSF 提交與預設值問題。

## [0.0.5-beta]
### Added
- 事件排序規則編輯器與排序預設（儲存/讀取/刪除），並新增 `cgeventsenh.sortingPresets` 設定儲存預設。
- 新增基礎設定、事件資訊與排序規則的 schema 定義檔，RJSF 表單可直接依 schema 渲染。
- 邏輯庫支援搜尋與麵包屑導覽（含返回/前進/上層）。
- 表單歷史操作：Undo/Redo 按鈕與 `Ctrl+Z` / `Ctrl+Y` 快捷鍵。
- RJSF 增強：陣列「全部移除」與群組勾選欄位。
- 新增載入畫面與動畫。
- 擴充語言選項（en-US/zh-Hant/zh-Hans/ja/ko）並提供與 VS Code 語言同步提示。

### Changed
- UI 版面改用 Bootstrap 並拆分模組化 CSS，移除 inline styles，導覽列/工具列強化響應式。
- Help 選單與導覽列重整：格式/語言切換、教學連結與 VS Code 設定入口整合。
- Monaco JSON 編輯器改為內部值控管與 full-height 佈局，新增剪貼簿快捷鍵與 blur commit。
- 邏輯清單互動與事件版面配置調整（選取、拖曳、排序顯示），改善操作體驗。

### Bug fixed
- 修正提示視窗定位與偏移問題。
- 修正 breadcrumb 溢出與清單版面問題。
- 修正 JSON 編輯器高度/容器撐滿問題。

## [0.0.4-beta]
### Added
- 使用 RJSF (React JSON Schema Form) 取代自製編輯面板，提供更完整的表單驗證與渲染。
- 整合 Monaco Editor 作為 JSON 編輯器。
- 事件與觸發/檢查/動作支援複製功能。
- 陣列欄位新增元素時自動設定初始值（string=`''`, number=`0`, boolean=`false` 等）。
- 新增雙擊編輯功能。
- VSCode 設定中新增語言選項。

### Changed
- 調整事件卡片與觸發/檢查/動作按鈕順序。
- 調整停用狀態的 UI 顯示。
- 基礎設定區塊位置上移。
- 建議選單行為優化：focus 時顯示、選擇後隱藏、重新輸入時再次顯示。
- CSS 類別全面重新命名，優化樣式結構。
- 在新增介面中隱藏 deprecated 的功能。
- 新增功能更改為編輯儲存後才新增至事件。

### Bug fixed
- 修正 checkbox 布局與溢出問題。

## [0.0.3-beta]
### Added
- 增加資料夾圖示於事件表的資料夾表示，以及篩選資料夾處。
- 觸發/檢查/動作清單支援多選、長按拖曳、跨事件移動與上下文選單，拖曳˙預覽與插入位置提示更清晰。
- 欄位支援 schema `suggest` 自動完成（含動態值、資源/來源）、描述以提示圖示呈現。
- 設定面板與 JSON 編輯器改版：新 JSON 編輯器元件、helper 預覽/套用按鈕與更緊湊的佈局。

### Changed
- 大幅重構執行邏輯，以提升效能。
  - 將JSON狀態與組件分離，降低刷新次數，使得拖曳與點擊回應速度提升。
  - CSS拆分。
- 調整視覺編輯介面上的按鈕/圖示調整。
- 更改事件表內的觸發/檢查/動作停用顯示。
- Schema `visible` 判斷改用 math.js 表達式，與CG邏輯同步。
- 布林欄位從下拉選單/輸入框更換為勾選框。

### Bug fixed
- 修正拖曳/長按拖曳的穩定性、自動捲動與跨事件移動後的選取清理。
- 修正 `visible` 判斷、複製 JSON 的型別與來源/資源提示文案。
- 清除多處 TypeScript 型別錯誤並移除空清單提示異常文字。
- 修正介面上誤植的文字/翻譯。

## [0.0.2-beta]
### Added
- 事件與資料夾可雙擊改名並防止衝突。
- 基礎設定增加舞台設定、布林值、選單的翻譯。
- 動作/觸發/檢查支援多選、複製/貼上與跨事件移動。
- 動作/觸發/檢查右鍵可將選取移動到指定位置。
- 預先載入的資源部分按照專案分組，並可折疊清單。
  - 測試資源不會出現在主專案內。
- 預先載入的來源部分按照附檔名分組，並可摺疊清單。
  - 測試來源檔案不會出現在主專案內。
### Changed
- 解析器擴充可預載資源型別，監看並掃描專案來源，`$schema` 改為可選。
- 事件 schema 與預設檔合併更安全。
- 傳給 webview 的訊息包含 CGAPP、資源、物品與來源清單。
- 擴充套件中繼資料加入 publisher。
### Bug fixed
- 拖曳動作/觸發/檢查的自動捲動更安全。
- 拖曳並釋放動作/觸發/檢查後會清除選取狀態。
- 動作/觸發/檢查貼上可用性檢查修正。

## [0.0.1-beta]
- 初始發佈。
