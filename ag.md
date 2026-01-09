接下去我们 需要再去获取OA的食堂数据，需要获取本周的菜单 请求 http://oa.lets.com/web/oa/canteen/ordermenulist post 参数 room_id: 19
order_type: 0  不变 响应头text/html; charset=UTF-8
说明后端已经将数据渲染到页面上了 所以我们需要去解析内容 获取需要的数据  我取页面需要的结构 放在canteen.html 我们只需要 tr class==order 的内容 需要的字段 有星期 早中晚餐 餐名 其余不需要 另外只需要取当周的 下周的餐名还没有出来 所以不要获取下来

{
  "code": 1024,
  "data": null,
  "msg": "请重新登录",
  "file": "/web/oa2/api/base.php",
  "line": 42,
  "log": null
}