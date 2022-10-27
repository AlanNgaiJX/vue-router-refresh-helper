/* refreshListHelper 列表返回更新插件
使用方法：
  1. 在 keepAlive 列表页面的 mounted 钩子中，使用 this.$router.registKeepAlivePage(this) 将该页面注册到插件中。（未在插件中注册的页面 无法执行更新任务 或 恢复滚动）
  2. 从 列表页面 点选某项A 进入 详情页面，在 beforeRouteLeave 钩子中记录页面滚动位置 this.$router.recordListScroll(this, scrollEl)
  3. 当进行过某种操作后，希望返回列表页后，更新 项A。则在操作成功后使用 this.$router.pushRefreshTask(<refreshTask>) 新建更新任务。
  4. 从 详情页 回到 列表页，在 activated 钩子中，执行列表更新 和 滚动恢复，this.$router.execRefreshQueue(this)，this.$router.recoverListScroll(this)。
  5. 从列表页返回首页，（希望从首页进去列表页时重新刷新页面），在 beforeRouteLeave 钩子中 使用 this.$router.destroyKeepAlivePage(this) 注销 keepAlive 页面。
*/

/* 【 刷新任务容器 】
  数据结构如下:
  {
    '/muc/list_a': null, // 已注册的 keepAlive 页面，且 该页面暂无刷新任务
    '/muc/list_b': [ refreshTask, refreshTask, ... ]// 已注册的 keepAlive 页面，且 该页面有刷新任务
    ...
    // 该容器中，不存在的key，如 '/muc/list_c' ，为 未注册的 keepAlive 页面
  }
*/
const refreshMap = {};

/* 【 滚动任务容器 】
  数据结构如下:
  {
    '/muc/list_a': null, // 已注册的 keepAlive 页面，且 该页面暂无滚动任务
    '/muc/list_b': [ { scrollEl, scrollTop } ]// 已注册的 keepAlive 页面，且 该页面有滚动任务
    ...
    // 该容器中，不存在的key，如 '/muc/list_c' ，为 未注册的 keepAlive 页面
  }
*/
const scrollMap = {};

// 【 传入router实例启用组件 】
function install(router) {
  router.refreshMap = refreshMap;
  router.scrollMap = scrollMap;
  router.pushRefreshTask = pushRefreshTask;
  router.execRefreshQueue = execRefreshQueue;
  router.registKeepAlivePage = registKeepAlivePage;
  router.destroyKeepAlivePage = destroyKeepAlivePage;
  router.recordListScroll = recordListScroll;
  router.recoverListScroll = recoverListScroll;
}

// 【 在插件中注册 KeepAlive页面：在页面的 mounted 钩子中完成，未注册的页面无法创建刷新任务 】
function registKeepAlivePage(vm) {
  const path = vm.$route.path;
  refreshMap[path] = null;
  scrollMap[path] = null;
}

// 【 刷新任务模板 】
const refreshTaskTemp = {
  path: "", // （必填）需要刷新的页面路由路径，如 /muc/list_a
  id: "", // （必填）需要刷新项的id
  idKey: "id", // （必填）列表中 item 的 id 字段名
  listKey: "", // （必填）列表的变量名，如在列表页面中 使用this.carList能访问到列表，则应为 listKey: "carList"
  del: false, // （选填）是否从列表中删除该项
  assign: null,// （选填）将对象的属性更新到该项，如 assign: { status: "FAIL"}，则将 status: "FAIL" 更新到列表项中
  fetch: null,// （选填）网络请求后更新列表项
};

// 【 创建列表更新任务 】
function pushRefreshTask(_task) {
  if (!_task.path) {
    return console.warn("入参错误，无path");
  }
  const isPathRegisted = Object.keys(this.refreshMap).includes(_task.path);
  if (!isPathRegisted) {
    return console.warn(`pushRefreshTask reject: ${_task.path} 尚未在 refreshListHelper 中注册`);
  }
  if (_task.id === undefined) {
    return console.warn("入参错误，无id");
  }
  if (_task.listKey === undefined) {
    return console.warn("入参错误，无listKey");
  }
  if (!_task.del && !_task.assign && !_task.fetch) {
    return console.warn("入参错误，del、assign 和 fetch 至少填一个");
  }
  if (_task.fetch && typeof _task.fetch !== "function") {
    return console.warn("入参错误，fetch 需为返回promise的函数");
  }
  const task = JSON.parse(JSON.stringify(refreshTaskTemp));
  const path = (task.path = _task.path);
  task.id = _task.id;
  task.idKey = _task.idKey || "id";
  task.listKey = _task.listKey;
  task.del = _task.del;
  task.assign = _task.assign;
  task.fetch = _task.fetch;

  if (!refreshMap[path]) {
    refreshMap[path] = [task];
  } else {
    if (task.fetch) {
      // fetch 方式更新，队列中更新同个数组，只能有唯一id
      const isExisit =
        refreshMap[path].findIndex(
          (item) => item.id === task.id && item.listKey === task.listKey
        ) > -1;
      !isExisit && refreshMap[path].push(task);
    } else {
      // assign 方式更新，队列中可以有多个同样的id
      refreshMap[path].push(task);
    }
    refreshMap[path].push(task);
  }
}

// 【 执行该页面的列表更新任务 】
function execRefreshQueue(vm) {
  const queue = this.refreshMap[vm.$route.path];
  if (queue) {
    while (queue.length) {
      const task = queue.pop();
      const { id, idKey, listKey, del, assign, fetch } = task;
      const list = vm[listKey];
      const targetIndex = list.findIndex((item) => item[idKey] == id);
      if (targetIndex > -1) {
        if (del) {
          list.splice(targetIndex, 1);
        } else {
          if (assign) {
            Object.assign(list[targetIndex], assign);
          }
          fetch &&
            fetch().then((res) => {
              // if (res.errcode === 0) {
              const newItem = res.data;
              list.splice(targetIndex, 1, newItem);
              // }
            });
        }
      }
    }
  }
}

// 【 销毁 keepAlive 页面，（再次进入该页面时会重新走 mounted 钩子），并在插件中注销该页面 】
function destroyKeepAlivePage(vm) {
  if (vm.$vnode && vm.$vnode.data.keepAlive && vm.$vnode.parent) {
    const tag = vm.$vnode.tag;
    let caches = vm.$vnode.parent.componentInstance.cache;
    let keys = vm.$vnode.parent.componentInstance.keys;
    for (let [key, cache] of Object.entries(caches)) {
      if (cache.tag === tag) {
        if (keys.length > 0 && keys.includes(key)) {
          keys.splice(keys.indexOf(key), 1);
        }
        delete caches[key];
      }
    }
  }
  const path = vm.$route.path;
  delete vm.$router.refreshMap[path];
  delete vm.$router.scrollMap[path];
  vm.$destroy();
}

// 【 记录列表的滚动位置：在页面的 beforeRouteLeave 钩子中完成 】
// vm: 页面实例 | scrollListEl: 滚动列表的dom节点
function recordListScroll(vm, scrollListEl) {
  const path = vm.$route.path;
  const scrollTop = scrollListEl.scrollTop;
  const isPathRegisted = Object.keys(this.scrollMap).includes(path);
  if (!isPathRegisted) {
    return console.warn(`recordListScroll reject: ${path} 尚未在 refreshListHelper 中注册`);
  }
  this.scrollMap[path] = {
    scrollListEl,
    scrollTop,
  };
}

// 【 恢复页面的滚动位置：在页面的 activated 钩子中完成 】
function recoverListScroll(vm) {
  const path = vm.$route.path;
  const { scrollListEl, scrollTop } = this.scrollMap[path];
  scrollListEl.scrollTop = scrollTop;
  this.scrollMap[path] = null;
}

export default {
  install,
};
