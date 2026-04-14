# Firebase 云同步配置指南

本指南帮助你完成 Firebase Realtime Database 的配置，让家人可以共同使用旅行分账 App，实时同步数据。

---

## 第一步：安装 Firebase SDK

在项目根目录打开终端，运行：

```bash
npx expo install firebase
```

> 如果你使用的是普通 npm 项目（非 Expo），运行：`npm install firebase`

---

## 第二步：创建 Firebase 项目

1. 打开浏览器，访问 [https://firebase.google.com](https://firebase.google.com)
2. 点击右上角 **"开始使用"** 或 **"Go to Console"**
3. 点击 **"添加项目"**（Add project）
4. 输入项目名称，例如 `travel-split`，点击继续
5. 关闭 Google Analytics（可选），点击 **"创建项目"**
6. 等待创建完成，点击 **"继续"**

---

## 第三步：注册 Web 应用

1. 在 Firebase 控制台主页，点击 **"</ >"**（Web 图标）注册一个 Web 应用
2. 输入应用昵称，例如 `travel-split-app`
3. **不勾选** Firebase Hosting，点击 **"注册应用"**
4. 你会看到一段类似这样的配置代码：

```javascript
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "travel-split.firebaseapp.com",
  databaseURL: "https://travel-split-default-rtdb.firebaseio.com",
  projectId: "travel-split",
  storageBucket: "travel-split.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123"
};
```

5. **复制并保存**这段配置（下一步会用到）

---

## 第四步：启用 Realtime Database

1. 在左侧菜单找到 **"构建"（Build）**，点击 **"Realtime Database"**
2. 点击 **"创建数据库"**（Create Database）
3. 选择数据库地区（推荐选择离你最近的，例如亚洲用户选 `singapore`）
4. 在安全规则页面，选择 **"以测试模式启动"**（Start in test mode）
5. 点击 **"启用"**

> ⚠️ **注意：** 测试模式下任何人都能读写数据，适合家庭内部小范围使用。如需更安全，见文末说明。

---

## 第五步：填写配置到代码中

打开文件 `src/firebase.ts`，找到以下部分：

```typescript
export const FIREBASE_CONFIG = {
  apiKey:            'YOUR_API_KEY',
  authDomain:        'YOUR_PROJECT_ID.firebaseapp.com',
  databaseURL:       'https://YOUR_PROJECT_ID-default-rtdb.firebaseio.com',
  projectId:         'YOUR_PROJECT_ID',
  storageBucket:     'YOUR_PROJECT_ID.appspot.com',
  messagingSenderId: 'YOUR_SENDER_ID',
  appId:             'YOUR_APP_ID',
};
```

将每个 `YOUR_...` 替换为你在第三步复制的真实配置值。例如：

```typescript
export const FIREBASE_CONFIG = {
  apiKey:            'AIzaSyXXXXXXXXXXXXXXXXXXXXX',
  authDomain:        'travel-split.firebaseapp.com',
  databaseURL:       'https://travel-split-default-rtdb.firebaseio.com',
  projectId:         'travel-split',
  storageBucket:     'travel-split.appspot.com',
  messagingSenderId: '123456789012',
  appId:             '1:123456789012:web:abcdef1234567890',
};
```

保存文件，重启 App（`npx expo start` → 按 `r` 重新加载）。

---

## 第六步：邀请家人共享项目

配置完成后，你就可以开始共享旅行项目了。

### 分享方（你）：
1. 打开 App，进入 **"项目"** 页面
2. 点击底部的 **"📡 分享"** 按钮
3. App 会自动生成一个 **6 位分享码**（例如：`KM4RXW`）
4. 点击 **"📤 发送给家人"**，通过微信或短信发送给家人

### 加入方（家人）：
1. 手机上安装 **Expo Go**：
   - iOS：App Store 搜索 "Expo Go"
   - Android：Google Play 搜索 "Expo Go"
2. 打开 Expo Go，扫描你电脑上 `npx expo start` 显示的二维码
3. 在 App 的 **"项目"** 页面，点击 **"🔗 加入项目"**
4. 输入收到的 6 位分享码，点击 **"加入"**
5. 成功后项目会自动出现在列表中，并实时同步所有数据 ✅

---

## 常见问题

**Q：修改了支出后，家人的 App 没有更新？**
A：检查两部手机都连接了网络。Firebase Realtime Database 需要网络连接才能同步。

**Q：看到 "Firebase 初始化失败" 的警告？**
A：检查 `src/firebase.ts` 中的 `databaseURL` 是否正确，尤其是末尾不要有多余的斜杠。

**Q：分享码是什么样的？**
A：6 位大写字母和数字的组合，去掉了容易混淆的 `0`/`O`/`I`/`1` 等字符，例如 `KM4RXW`。

**Q：一个项目可以多少人加入？**
A：无限制。只要有分享码，任何人都可以加入，共同记录支出。

---

## 可选：加固数据库安全规则

如果你不希望陌生人访问你的数据，可以在 Firebase 控制台 → Realtime Database → **"规则"** 标签页，将规则改为：

```json
{
  "rules": {
    "trips": {
      "$tripCode": {
        ".read": true,
        ".write": true
      }
    }
  }
}
```

这样即使没有登录也可以访问，但仍比完全开放模式稍微规范一些。如需更严格的保护，请参考 [Firebase 安全规则文档](https://firebase.google.com/docs/database/security)。

---

配置完成后，你的旅行分账 App 就支持多人实时协作了 🎉
