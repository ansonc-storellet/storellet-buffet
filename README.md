# Storellet仔食自助餐

手機版三消遊戲，每局 30 啖，以最高分為目標。

## 本機試玩

使用 Python 3 開啟靜態伺服器：

```sh
python3 -m http.server 8080 --directory dist
```

在瀏覽器開啟 http://localhost:8080 ，以手機尺寸檢視。

## 測試

使用 Node.js 22 或以上版本：

```sh
node --test
```

## Cloudflare Pages 部署

| 設定 | 值 |
| --- | --- |
| Production branch | `main` |
| Framework preset | None |
| Build command | 留空 |
| Build output directory | `dist` |
| Root directory | 留空 |

`dist/` 包含完整靜態網頁、遊戲程式及圖片，無需安裝依賴或建置。接駁 GitHub 後，推送至 `main` 會觸發 Cloudflare Pages 正式部署。

## 版本說明

本版本包含刀叉舐嘴 Storellet 仔、立體自助餐棋盤封面，以及「移除一格」會觸發橫向、直向或金色圖示原有消除效果的玩法。

目前為試玩版：個人紀錄及每日試玩次數儲存在瀏覽器本機。會員積分、正式排行榜及獎賞兌換尚未接駁後端，試玩不會扣取真實會員積分。不同裝置或瀏覽器不會同步紀錄。

Storellet 品牌、角色及圖片之權利由其權利人保留；公開原始碼不代表授予品牌素材使用權。
