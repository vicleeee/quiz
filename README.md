# 英语单选闯关

中小学英语单选题闯关游戏，支持班级管理、随机抽题、排行榜、教师后台。

## 演示地址

🔗 **学生端**: https://lxl.bella.press/quiz-new/index.html

🔗 **教师端**: https://lxl.bella.press/quiz-new/index.html?role=teacher

## 功能特点

- **班级 + 姓名选择**：从花名册中加载班级和学生名单
- **选择题量**：5/10/15/20 题可选，从题库中随机抽取
- **答题反馈**：即时判断对错，显示解析，配有音效
- **排行榜**：按综合得分排名（准确率 + 速度）
- **教师后台**：查看全部答题记录、按班级筛选、导出 CSV
- **题目管理**：新增/编辑/删除题目、按班级筛选
- **QuickForm 集成**：数据存储在 QuickForm，支持自定义 API 地址

## 教师入口

学生端页面底部点「🏆 查看排行榜」，或在 URL 后加 `?role=teacher` 进入教师后台。

## API 配置

| 用途 | 默认地址 |
|------|----------|
| 班级花名册 | `quickform.cn/api/5j9aayuuzl` |
| 每周单选题 | `quickform.cn/api/uzubqztmvc` |
| 做题记录 | `quickform.cn/api/9x9k35vdah` |

支持自定义：展开页面底部「⚙️ 自定义 API 地址」修改并保存。

## 部署

```bash
# Python 本地测试
cd quiz-new && python -m http.server 8080

# 腾讯云 COS
# 上传文件夹 → 开启静态网站托管 → 绑定自定义域名
```

## 开发文档

详见 [DEV.md](DEV.md)

## License

MIT
