/**
 * 一个平台写一个脚本文件，主要用于处理dom查找、dom操作
 */
'use strict';
// import { sleep } from './util.js'

// function sleep(ms) {
//   const p = new Promise(
//       resolve => {
//           console.log("sellep", ms);
//           setTimeout(resolve, ms)
//       })
//   return p
// }

// 从悟空用户链接析取uid
// 在cs中访问不到
function getUidFromWukongUserLink(link) {
  let uid = 0
  let arr = user.link.match(/uid=(\d+)/i)
  // console.log("arr",arr);
  if (arr.length > 1) {
    uid = parseFloat(arr[1])
  }
  return uid
}

export default {
  isFollowMyFans:async ()=>{
    let users = []
    let followBtns = document.querySelectorAll("div.btn-attention:not(.each):not(.following)")

    let numHasNoNewFans = 0
    let numFans = 0
    for (let j = 0; j < 20; j++) {
      numFans = followBtns.length
      await window.scrollBy(0, 1000)
      await sleep(1000 * SLEEP_FACTOR)
      followBtns = document.querySelectorAll("div.btn-attention:not(.each):not(.following)")
      if (followBtns.length > numFans){
        numHasNoNewFans = 0
      }else{
        numHasNoNewFans++
      }
      if (numHasNoNewFans > 3) break
    }

    for (const followBtn of followBtns) {
      if (!followBtn.classList.contains(".each")){
        followBtn.click()
        await sleep(1000 * SLEEP_FACTOR)
      }
      let userLink = followBtn.parentElement.parentElement.querySelector("dd:not(.avatar-wrap) a")
      let {href:link, textContent:name} = userLink
      users.push({
        name,
        link
      })
      // if (users.length > 3) break
    }

    return users
  },
  // 拿到uid，从用户首页直接取不到，使用搜索就取到了
  // `https://www.toutiao.com/search/?keyword=${name}`
  csFetchUidFromUserSearchPage: async () => {
    let uid = 0
    // 单击“用户”tab
    document.querySelectorAll("li.y-left.tab-item")[2].click()
    await sleep(1000)
    let userLink = document.querySelector("a.y-box.link")
    if (userLink && (/user\/(\d+)\//i).test(userLink.href)) {
      uid = parseFloat(RegExp.$1)
    }
    return uid
  },
  // 从悟空首页拿到用户对象
  // `https://www.wukong.com/user/?uid=${uid}`
  csFetchUserFromWukongUserHome:async (uid)=>{
    let user = {
      name: '',
      link: '',
      desc: '',
      uid: uid,
      state: 0,
      interactive_value:0
    }
    // 这是为了防止拉取不到，因网络原因
    let userInfo =document.querySelector("div.userinfo")
    for (let j = 0; j < 3; j++) {
      if (userInfo) break
      await sleep(500)
      userInfo =document.querySelector("div.userinfo")
    }

    if (userInfo){
      let userLink = userInfo.querySelector("a")
      if (userLink){
        user.link = userLink.href
        let userNameH1 = userInfo.querySelector("h1.user-name")
        if (userNameH1) user.name = userNameH1.textContent.replace(/\s+/g, '')
        let userInfoDev = userInfo.querySelector("div.user-intro")
        if (userInfoDev) user.desc = userInfoDev.textContent.replace(/\s+/g, '')
      }
    }

    return user
  },
  // 拿到uid，从用户首页
  csFetchUidFromUserHomePage: async () => {
    let uid = 0
    let userLink = document.querySelector("a[ga_event=user_head_click]")
    if (userLink) {
      let arr = userLink.href.match(/user\/(\d+)\//i)
      if (arr && arr.length > 1) {
        uid = parseFloat(arr[1])
      }
    }

    return uid
  },
  // 可以拿到user token，从用户首页
  // csFetchUserTokenFromUserHomePage: async () => {
  //   let uid = 0
  //   let userLink = document.querySelector("a[ga_event=user_head_click]")
  //   if (userLink) {
  //     let arr = userLink.href.match(/user\/(\d+)\//i)
  //     if (arr && arr.length > 1) {
  //       uid = parseFloat(arr[1])
  //     }
  //   }

  //   return uid
  // },

  isFetchUserDataFromMyFansPage:async ()=>{
    console.log('SLEEP_FACTOR',SLEEP_FACTOR);

    let users = []
    let numHasNoNewFans = 0 
    let numFans = 0
    let followBtns = document.querySelectorAll("div.btn-attention:not(.each):not(.following)")

    for (let j = 0; j < 10; j++) {
      numFans = followBtns.length
      window.scrollBy(0, 1000)
      await sleep(1000 * SLEEP_FACTOR)    
      followBtns = document.querySelectorAll("div.btn-attention:not(.each):not(.following)")
      if (followBtns.length > numFans){
        numHasNoNewFans = 0 
        continue
      }else{
        numHasNoNewFans++
      }
      if (numHasNoNewFans > 3) break
    }

    for (const followBtn of followBtns) {
      // 关注
      if (!followBtn.classList.contains(".each")){
        followBtn.click()
        await sleep(500 * SLEEP_FACTOR)
      }
      let userLink = followBtn.parentElement.parentElement.querySelector("dd:not(.avatar-wrap) a")
      // let {textContent:name,href:link} = userLink
      let name = userLink.textContent
      let link = userLink.href
      console.log("name link",name,link);
      users.push({
        name,
        link
      })
      if (users.length > 2) break
    }
    return users
  },
  // 在一篇文章中获取用户，这个用户对象并不优质，没有描述，并且名称也需要过滤
  // 有不少机构帐号会出现在这里
  csFetchUserFromOneToutiaoArticle: async (cmd, options) => {
    let user = {
      name: '',
      link: '',
      desc: '',
      uid: 0
    }
    // const MY_TUOTIAO_NAME = '石桥码农'
    // await sleep(1000) 
    window.scrollBy(0, 500)//滚动一下

    let followArticleAuthorBtn = document.querySelector("div.left-arrow.subscribe-btn")
    for (let j = 0; j < 3; j++) {
      if (followArticleAuthorBtn) break
      await sleep(500)
      followArticleAuthorBtn = document.querySelector("div.left-arrow.subscribe-btn")
    }

    if (followArticleAuthorBtn) {
      let authorNameItem = followArticleAuthorBtn.parentElement.parentElement.querySelector("a")
      if (authorNameItem) {
        user.name = authorNameItem.textContent
        user.link = authorNameItem.href
        let arr = user.link.match(/user\/(\d+)\//i)
        if (arr && arr.length > 1) {
          user.uid = parseFloat(arr[1])
        }
      }
    }
    return user
  },
  // 从一篇文章查看相关推荐阅读的文章链接
  csFindRelativeArticlesFromOneArticle: async (cmd, options) => {
    let links = []
    // const MY_TUOTIAO_NAME = '石桥码农'

    // 20篇文章，每篇要保证至少找到50个作者，一共找到1000个新作者关注对象
    // 这个地方，只有第一屏相关推荐的
    let articleItems = document.querySelectorAll("div[ga_event=article_item_click]")
    for (let j = 0; j < 5; j++) {
      if (articleItems.length > 0) break
      await sleep(1000)
      articleItems = document.querySelectorAll("div[ga_event=article_item_click]")
    }

    for (let j = 0; j < articleItems.length; j++) {
      let item = articleItems[j]
      let articleAuthorItem = item.querySelector("a[ga_event=article_name_click]")
      if (articleAuthorItem && articleAuthorItem.textContent.substr(1, articleAuthorItem.textContent.length - 3) != MY_TUOTIAO_NAME) {
        let linkItem = item.querySelector("div[ga_event=article_title_click] a")
        if (linkItem) {
          links.push(linkItem.href)
        }
      }
    }

    return links
  },
  // 获取我最近的文章列表
  csFetchMyRecentArticles: async (cmd, options) => {
    let links = []
    let maxNum = options.maxNum || 50

    let artileItems = document.querySelectorAll("div.article-card")
    for (let j = 0; j < 3; j++) {
      if (artileItems.length > 0) break
      await sleep(1000)
      artileItems = document.querySelectorAll("div.article-card")
    }

    let n = Math.min(maxNum, artileItems.length)//前三篇，或从参数中取，一天其实写不了三篇文章
    for (let j = 0; j < n; j++) {
      let item = artileItems[j]
      let linkItem = item.querySelector("div.article-card-wrap a")
      if (linkItem) links.push(linkItem.href)
    }

    return links
  },
  // 从头条搜索获取用户地址
  // https://www.toutiao.com/search/?keyword=
  csFetchUserFromToutiaoSearchPage: async () => {
    let user = {
      name: '',
      link: '',
      desc: '',
      uid: 0
    }
    let userLinkBlock = document.querySelector("a[ga_event=pgc_item_click]")
    if (userLinkBlock) {
      user.link = userLinkBlock.href
      if (user.link) {
        // http://www.toutiao.com/c/user/86919547088/
        let arr = user.link.match(/user\/(\d+)\//i)
        if (arr && arr.length > 1) {
          user.uid = parseFloat(arr[1])
        }
      }
      let nameEm = userLinkBlock.querySelector("em.highlight")
      if (nameEm) user.name = nameEm.textContent
      let descP = userLinkBlock.querySelector("p.desc")
      if (descP) user.desc = descP.textContent
    }

    return user
  },
  // 从悟空搜索页获取用户首页地址
  csFetchUserFromWukongSearchPage: async () => {
    let user = {
      name: '',
      link: '',
      desc: '',
      uid: 0
    }

    let searchedUser = document.querySelector("div.w-search-user")
    for (let j = 0; j < 5; j++) {
      if (searchedUser > 0) break
      await sleep(1000)
      searchedUser = document.querySelector("div.w-search-user")
    }

    let tabBtns = document.querySelector("div.search-tab").children
    let tabBtn = tabBtns[2]
    tabBtn.click()
    await sleep(200)

    if (searchedUser) {
      let userLink = searchedUser.querySelector("a.user-info")
      let uname = userLink.querySelector("span.uname")
      if (uname) user.name = uname.textContent
      let intro = userLink.querySelector("span.intro")
      if (intro) user.desc = intro.textContent
      user.link = userLink.href
      let arr = user.link.match(/uid=(\d+)/i)
      // console.log("arr",arr);
      if (arr && arr.length > 1) {
        user.uid = parseFloat(arr[1])
      }
    }

    return user
  },
  // 从问答每日榜单获取用户名称列表
  csFetchUserNamesFromWendaRank: async () => {
    let result = []
    let userHeaders = document.querySelectorAll("div.answer-header")
    for (let j = 0; j < 5; j++) {
      if (userHeaders.length > 0) break
      await sleep(1000)
      userHeaders = document.querySelectorAll("div.answer-header")
    }
    for (let j=0;j<10;j++){
      window.scrollBy(0,1000)
      await sleep(1000)
      userHeaders = document.querySelectorAll("div.answer-header")
    }

    for (let userHeader of userHeaders) {
      let userName = userHeader.querySelector("span.name")
      if (userName) result.push(userName.textContent)
    }
    return result
  },
  // 从悟空首页取用户列表
  csFetchUserListFromWukongHomePage: async (cmd, options) => {
    // console.log(cmd, options);
    let result = []
    let selectedTabItems = []
    console.log("SLEEP_FACTOR",SLEEP_FACTOR)

    let tabItems = document.querySelectorAll("a.tag-item")
    for (let tabItem of tabItems) {
      // console.log(tabItem.textContent)
      // if (tabItem.textContent == '科技' || tabItem.textContent == '文化') {
      //   selectedTabItems.push(tabItem)
      // }
      if (tabItem.textContent != '热门' ){
        selectedTabItems.push(tabItem)
      }
      // 只浏览3个，便于测试
      if (selectedTabItems.length >= 3) break
    }
    // return tabItems

    for (let tabItem of selectedTabItems) {
      // 切换一下分类
      tabItem.click()
      await sleep(2000 * SLEEP_FACTOR)

      // 保证取到列表
      let userFeedList = document.querySelector("div.w-feed-container").children
      for (let j = 0; j < 5; j++) {
        if (userFeedList.length > 0) break
        await sleep(2000 * SLEEP_FACTOR)
        userFeedList = document.querySelector("div.w-feed-container").children
      }

      // return userFeedList
      for (let userFeed of userFeedList) {
        let user = {
          name: '',
          link: '',
          desc: '',
          uid: 0,
          interactive_value:5
        }
        window.scrollBy(0, 200)
        let likeItBtn = userFeed.querySelector("a.w-like")
        if (likeItBtn && Math.random() < 0.8) {
          // 在恰当的时机，赠送用户一个点赞
          likeItBtn.click()
          await sleep(500 * SLEEP_FACTOR)
        }
        let userHomeLink = userFeed.querySelector("a.answer-info-user-avatar")
        if (userHomeLink) {
          user.link = userHomeLink.href
          user.name = userHomeLink.textContent.replace(/\s+/g, '')
        }
        let userDescSpan = userFeed.querySelector("span.answer-info-user-title")
        if (userDescSpan) user.desc = userDescSpan.textContent
        if (user.link) {
          // console.log("user.link",user.link);
          // https://www.wukong.com/user/?uid=86209257760
          let arr = user.link.match(/uid=(\d+)/i)
          // console.log("arr",arr);
          if (arr.length > 1) {
            user.uid = parseFloat(arr[1])
            if (user.uid > 0 && user.name != '' && user.desc != '') result.push(user)
          }
        }
        await sleep(1000 * SLEEP_FACTOR)
      }
    }
    return result
  }
}

// async function fetchUserListFromWukongHomePage() {
//   let result = []
//   let selectedTabItems = []

//   let tabItems = document.querySelectorAll("a.tag-item")
//   for (let tabItem of tabItems) {
//     // console.log(tabItem.textContent)
//     if (tabItem.textContent == '科技' || tabItem.textContent == '文化') {
//       selectedTabItems.push(tabItem)
//     }
//   }
//   return tabItems
// }

// const toutiao = new Toutiao()
// export default toutiao
// export default {
//   fetchUserListFromWukongHomePage
// }

// const 
// window.onload = function() {
//   window.__toutiao = new Toutiao()
// }

// define(function () {
//   class Tuotiao { //定义了一个名字为Person的类
//     constructor(name, age) { //constructor是一个构造方法，用来接收参数
//       this.name = name;  //this代表的是实例对象
//       this.age = age;
//     }
//     sayInfo() {
//       console.log(`${this.name}是${this.age}岁`)
//       return this.name
//     }
//     fetchUsers(){
//       return document.querySelector("div.w-feed-container").children
//     }
//     // 打开一个新的tab，并返回tabid
//     // async openNewTab(url = 'blank'){
//     //   let { tabId: activeTabId } = await chrome.tabs.createAndWait({ url, active: false })
//     //   console.log(activeTabId);

//     //   return activeTabId
//     // }
//     // 从悟空科技、文化查找值得主动关注的作者

//   }
//   // 这个实例是缓存的，全局一个
//   const t = new Tuotiao('LiLei', 21)
//   return t
// })

// function fetchUsers(){
//   return document.querySelector("div.w-feed-container").children
// }

// define(['require'],
//   function (require) {
//     class Tuotiao { //定义了一个名字为Person的类
//       constructor(name, age) { //constructor是一个构造方法，用来接收参数
//         this.name = name;  //this代表的是实例对象
//         this.age = age;
//       }
//       sayInfo() {
//         console.log(`${this.name}是${this.age}岁`)
//         return this.name
//       }
//       fetchUsers() {
//         return document.querySelector("div.w-feed-container").children
//       }
//       // 打开一个新的tab，并返回tabid
//       // async openNewTab(url = 'blank'){
//       //   let { tabId: activeTabId } = await chrome.tabs.createAndWait({ url, active: false })
//       //   console.log(activeTabId);

//       //   return activeTabId
//       // }
//       // 从悟空科技、文化查找值得主动关注的作者

//     }
//     // 这个实例是缓存的，全局一个
//     const t = new Tuotiao('LiLei', 21)
//     // return t

//     var promise = new Promise(function (resovle, reject) {
//       resovle(t)
//     });

//     return promise;
//   }
// );