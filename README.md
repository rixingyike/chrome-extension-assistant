# wemedia-smart-assistant

一个自毁体浏览器插件，代替作者做一些点击、评论的体力活

## 如何使用

需要在本地创建一个mysql database: chrome_extension_assistant。

需要先启动后端

```bash
cd server
go get github.com/codegangsta/gin
export GO111MODULE=on
go mod download
./dev.sh
```

直接在chrome浏览扩展中添加根目录为插件。插件名称为“自媒体智能助理”。

## 功能

### 从悟空首页拉新



## 已完成的
- 在popup内也可以使用await/async了，秘诀就是引用那两个js文件到html中

## todo list

- 在content script中的comment list、sleep能不能在一个地方定义，多个地方引用？
在content-script中定义共用的变量和函数，在background中定义操作，直接取用共享数据与方法
将通用配置对象定义在cs中，例如window.yyconfig，在bg中可以随时修改它
将一些在各种操作中需要用到的参数，定义到yyconfig中

- 架构调整：将点赞、收藏、评论，依平台，单独封装为一个一个的js文件，在需要时调用
- 想到三个优化点【三新】：拉新、回新、维新
 - 拉新，在自己文章的相关文章里找新作者，关注之，点评赞
 - 回新，对新粉丝，点评赞
 - 维新，对粉丝例行回访点评赞

- 将配置写进一个对象中，每个操作充许修改为不同的配置，这个配置对象在操作中是游走的
- 将数据与程序完全分开，不要因为程序出问题，造成数据丢失
- 有时候这个配置为什么写不进去，写错了？
- 评论找错了，“半夏原创图文来了。在本篇，聊一聊于汉超涂改车牌，郝海东忿忿不平，高晓松顶格量刑，阿娇误了前程。[微笑] +1
- 能不能请求网络
- 关闭popup之后，原来的定时器没有办法停止
- 目前单个ip流量太大，易打不开网页
- √call api http://t.weather.sojson.com/api/weather/city/101030100
- √需要一个js日期定时器
- √use golang and local mysql
- √bg中js如何模块化，终于可以使用es6 module模块化了
- √拉新，从悟空科技、文化类拉取用户列表
- √将拉取到的用户列表，存在db，写存的api


## 一些问题
- content-script与injected script有什么区别？

## 注意
- 在空的tab页是不可以测试插件的
- 头条网站有防制抓取机制，使用4g，不使用wifi

## 关于测试
修改源码后，在chrome://extensions/中开启开发者模式，点一下刷新按钮，这种方式就很快。

## 技术参考链接
- https://www.npmjs.com/package/chrome-extension-async
- https://www.cnblogs.com/liuxianan/p/chrome-plugin-develop.html
- https://developer.chrome.com/extensions/tabs
- http://requirejs.org/
- https://chajian.baidu.com/developer/extensions/api_index.html
- https://www.cnblogs.com/champagne/p/
- http://open.chrome.360.cn/extension_dev/overview.html
- https://blog.csdn.net/youyicc/article/details/100579524 Chrome配置和使用PPAPI-环境配置
- https://www.runoob.com/w3cnote/requirejs-tutorial-2.html
- https://lunny.gitbooks.io/xorm-manual-zh-cn/content/chapter-05/1.conditions.html
- https://www.w3school.com.cn/jquery/ajax_ajax.asp


## use iris

go env -w GO111MODULE=on

install 

Cannot find module '@babel/core'

npm install babel-core babel-preset-env gulp-babel@7 babel-core babel-plugin-transform-remove-strict-mode gulp-concat --save-dev

## 联系方式

有问题请关注微信公众号“程序员LIYI”联系作者。

![](https://yishulun.com/images/ghqrcode.jpg)