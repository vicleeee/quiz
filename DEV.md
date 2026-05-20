# DEV.md — 英语单选闯关 开发文档

## 演示地址

- `quiz`: https://lxl.bella.press/quiz/index.html
- `quiz-new`: https://lxl.bella.press/quiz-new/index.html

## 文件结构

```
quiz-new/
  index.html    — 学生端主页面（选择班级/姓名 → 答题 → 查看结果）
  teacher.html  — 无需单独打开，通过 ?role=teacher 参数或排行榜按钮进入
  core.js       — 核心逻辑：API配置、初始化、答题流程、成绩提交
  teacher.js    — 教师后台：排行榜、答题记录、数据导出（依赖 core.js）
  manage.js     — 题目管理、学生管理（教师端功能，依赖 core.js）
  style.css     — 全局样式
```

## API 配置（最重要）

### 三个 QuickForm API 地址

| 用途 | 默认地址 | localStorage Key |
|------|----------|-----------------|
| 班级花名册 | `https://quickform.cn/api/5j9aayuuzl` | `quizApi_students` |
| 每周单选题 | `https://quickform.cn/api/uzubqztmvc` | `quizApi_questions` |
| 做题记录 | `https://quickform.cn/api/9x9k35vdah` | `quizApi_records` |

### 修改默认 API 地址

编辑 `core.js`，搜索 `getApiUrl` 调用，修改第三个参数：

```javascript
// 例子：把做题记录改成新的 API 路径
// 改前：
records:{ read:getApiUrl('records','9x9k35vdah','/all'), ... }
// 改后：
records:{ read:getApiUrl('records','新路径','/all'), ... }
```

同时修改 `index.html` 中设置面板的 `placeholder` 属性。

### API 地址读取逻辑

`core.js` 第 12 行 `getApiUrl()` 函数：

```javascript
function getApiUrl(key, defaultPath, suffix){
  var s = localStorage.getItem('quizApi_'+key);  // 优先读用户自定义
  var base = s || ('https://quickform.cn/api/'+defaultPath);  // 否则用默认
  return suffix ? base+suffix : base;
}
```

- 首次加载：用默认地址
- 用户在设置面板保存后：写入 localStorage → 自动刷新页面 → 下次加载用自定义地址
- 清空设置面板输入框并保存 → 删除 localStorage → 恢复默认地址

### 初始化流程

`core.js` → `init()` 函数：

1. 并行请求 `API.questions.read` 和 `API.students.read`
2. 解析题目数据（`sub.data` 或 `sub.raw_data`）
3. 解析学生名单
4. 如果 `allQuestions.length === 0` → 显示「暂无题目数据」
5. 渲染班级下拉框 → 学生选择界面

### 数据提交流程

答题完成后 `core.js` → `submitResult()`：

```javascript
fetch(API.records.post, {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({
    student_name, student_class, accuracy, total_questions,
    correct_count, wrong_count, time_spent, details, ...
  })
})
```

### 排行榜加载

两种触发方式：
1. 学生端点击「查看排行榜」→ `loadRanking()` → `fetch(API.records.read)`
2. 教师端 → `init()` 时自动加载 `API.records.read`

## 常见问题

### "暂无题目数据"
- QuickForm 题目 API 无数据 → 检查 `API.questions.read` 地址
- API 返回格式变化 → 检查 `sub.data` vs `sub.raw_data`

### 做题后排行榜无记录
- 检查 `API.records.post` 地址
- 检查浏览器 localStorage 是否缓存了旧地址（`quizApi_records`）
- 打开设置面板清空对应输入框并保存

### 自定义 API 后不生效
- 保存后页面会自动刷新（`location.reload()`）
- 如未自动刷新，手动刷新或执行 `localStorage.removeItem('quizApi_records');location.reload()`

## 部署

纯静态文件，放到任意 HTTP 服务器即可。所有 API 调用均为前端 fetch，无需后端。