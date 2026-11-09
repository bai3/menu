# 家宴 Android

原生 WebView 外壳，入口为 `https://bai3.github.io/menu/`。网页继续独立部署；首次打开需要联网。支持 Android 8.0（API 26）及以上，手机需保持 Android System WebView 更新，以运行网页使用的现代 JavaScript。

## 构建测试 APK

使用 JDK 17 及以上（推荐 Android Studio 自带 JDK 21），安装 Android SDK Platform 36 和 Build Tools 36.0.0。

```sh
export JAVA_HOME='/Applications/Android Studio.app/Contents/jbr/Contents/Home'
export ANDROID_HOME="$HOME/Library/Android/sdk"
bash android/build-apk.sh
```

若安装的是 `android-36.1`，执行 `SDK_PLATFORM=android-36.1 bash android/build-apk.sh`。

产物：`android/app/build/sdk-debug/jiayan.apk`。脚本自动校验签名，使用 `android/debug.keystore` 本地测试证书；证书不入库，需保留才能覆盖更新已安装的测试包。版本号、URL 需在脚本和 Gradle 配置中同时修改。

也可用 Android Studio 打开本目录，通过 Gradle 构建。Android Studio 使用自己的测试证书，与脚本不同，不同证书的包不能覆盖安装。正式分发前应设置独立、妥善备份的 release 签名，并递增 versionCode。

## 在线更新

- H5 通过原来的部署流程更新，不把网页打进 APK。
- 网页沿用现有 Service Worker 缓存和更新提示。发布网页时继续递增 `sw.js` 的 `VERSION`。
- 打开 App、恢复前台时检查更新；新版资源下载完成后提示“发现新版本，刷新后即可使用”，点击刷新后生效，避免强制打断点菜。
- 更新依赖网络可用、网页部署成功和缓存版本正确更新。离线无法获取新版；首次成功访问后沿用 PWA 离线能力，不承诺离线登录和云端操作。
- 修改原生能力、安装图标或入口域名仍需重新打包。更换地址需同时修改 `app/build.gradle` 和 `build-apk.sh`。

## 已接入

- 网页邮箱登录与持久化存储；App 与浏览器的登录状态分开。
- 系统文件选择器，用于照片上传。
- 菜单和买菜清单的“下载图片”按钮，通过系统保存窗口导出 PNG/JPEG/WebP（最大 20 MiB），无需存储权限。
- 系统栏避让、加载进度、失败重试、返回历史、双击返回退出。
- 站内页面在 App 中打开，外部 HTTP(S)/邮件/电话链接交给系统应用。
- 禁止明文 HTTP、混合内容和 file URL 文件访问；不绕过 TLS 校验。

## 验收范围

当前已通过 SDK 编译、打包和 APK 签名校验，尚未完成真机验收。安装后检查登录/退出、重启后登录保持、选菜与买菜清单、照片上传、图片保存、共享链接、返回键、旋转屏幕、断网重试，以及发布新版 H5 后恢复前台并刷新更新。

未接入 Android App Links，邀请链接默认仍在浏览器打开。Web Share 按钮是否可见取决于系统 WebView，图片可通过“下载图片”保存。

## 启动展示

APK 通过 `JiayanAndroid/` User-Agent 在页面解析时识别原生环境，只展示原生启动页；PWA 单独展示 H5 启动页，普通浏览器不展示品牌启动页。以原有 PWA 启动页为视觉基准：纸纹米色背景、圆角图标、家宴标题、「家的味道，日日有新意」和底部「为每一顿家常饭」。App 使用原生 Drawable 绘制相同布局，等待 H5 首屏绘制后直接显示页面。Android 12 及以上将系统初始画面设为同色背景，不显示大号默认 Logo，立即衔接原生完整品牌页。

H5 首次渲染登录或应用内容后，通过 `JiayanImageExport.ready()` 显示 WebView；加载失败有超时与重试入口。账号密码登录在当前文档内完成，不刷新整页、不重新展示启动页。

此变更需部署新版 H5，并重新安装 1.0.2（versionCode 3）APK；未完成真机启动视觉验收。
