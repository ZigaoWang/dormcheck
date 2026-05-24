# tally Android App

签到 PDA 客户端 — 适配 Urovo i6310 (Android 7.0+)

## 功能

- RFID/NFC 刷卡签到（13.56MHz 校园卡）
- 红外体温检测（Urovo i6310 内置传感器）
- 离线签到队列（网络恢复后自动同步）
- 晨检/晚检/晚自习 三种签到模式
- 实时状态反馈（声音 + 震动 + 颜色）
- 迟到/发热 自动标记与告警

## 系统要求

- Android 7.0+ (API 24)
- NFC/RFID 读卡器
- 网络连接（支持离线缓存）

## 构建

### 前置条件

1. 安装 [Android Studio](https://developer.android.com/studio) (Arctic Fox+)
2. 安装 Android SDK 28
3. 确保 JDK 8+ 已安装

### 编译

```bash
cd android
./gradlew assembleDebug
```

APK 输出路径: `app/build/outputs/apk/debug/app-debug.apk`

### Release 构建

```bash
./gradlew assembleRelease
```

需要在 `app/build.gradle` 中配置签名:

```gradle
android {
    signingConfigs {
        release {
            storeFile file("your-keystore.jks")
            storePassword "xxx"
            keyAlias "xxx"
            keyPassword "xxx"
        }
    }
    buildTypes {
        release {
            signingConfig signingConfigs.release
        }
    }
}
```

## 配置

### 服务器地址

在 `gradle.properties` 中设置默认服务器地址:

```properties
API_BASE_URL=https://your-tally-server.com
```

或在首次启动时通过 UI 配置。

### 设备注册

1. 在 Web 管理后台 → 设备管理 → 添加设备
2. 复制生成的 API Key (`dk_xxx...`)
3. 在 PDA 上打开 App → 输入服务器地址和 API Key → 连接

## 安装到 Urovo i6310

```bash
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

或通过 USB 传输 APK 文件后在设备上安装。

## 架构

```
com.tally.app/
├── TallyApp.kt              # Application 入口
├── data/
│   ├── api/                 # Retrofit API 接口
│   ├── local/               # Room 数据库 + SharedPreferences
│   └── repository/          # 数据仓库层
├── device/
│   ├── nfc/                 # NFC/RFID 读卡器
│   └── temperature/         # 体温传感器抽象
├── domain/model/            # 数据模型
├── ui/
│   ├── checkin/             # 签到主界面
│   └── setup/               # 设备配置界面
└── util/                    # 工具类
```

## Urovo SDK 集成

体温传感器模块 (`UrovoTemperatureSensor.kt`) 目前为桩实现。
当 i6310 设备到达后，需要:

1. 获取 Urovo SDK JAR/AAR
2. 放入 `app/libs/` 目录
3. 在 `build.gradle` 添加: `implementation fileTree(dir: 'libs', include: ['*.jar', '*.aar'])`
4. 实现 `UrovoTemperatureSensor` 中的 TODO 方法

## 离线模式

当网络不可用时:
- 签到数据自动存入本地 Room 数据库
- 界面显示队列计数
- 网络恢复后自动重试
- 超过 50 次重试的记录自动清理
