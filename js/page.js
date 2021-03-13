$(function () {
  new Vue({
    el:"#js_page",
    data:{
      init: false,
      tabIndex:0,
      libs:[
          {
              name:"my",
              isSelected:false,
              url:"js/my.js"
          },
        {
          name:"jQuery1.x",
          isSelected:false,
          url:"https://cdn.bootcss.com/jquery/1.12.0/jquery.min.js"
        },
        {
          name:"jQuery2.x",
          isSelected:false,
          url:"https://cdn.bootcss.com/jquery/2.2.2/jquery.min.js"
        },
        {
          name:"jQuery3.x",
          isSelected:false,
          url:"https://cdn.bootcss.com/jquery/3.1.1/jquery.min.js"
        },
        {
          name:"underscore1.8.3",
          isSelected:false,
          url:"https://cdn.bootcss.com/underscore.js/1.8.3/underscore-min.js"
        }
      ],
      inputUrl:""
    },
    methods:{
      injectJs:function () {
        var that = this;
        switch (that.tabIndex) {
          case 0:that.injectLibFromPop();
                break;
          case 1:that.injectLibFromInput();
                break;
        }

      },

      injectLibFromInput:function(){
          var that = this;
          if(that.inputUrl){
            var temp = [{
              name:"inputLib",
              url:that.inputUrl
            }];
            that.sendInjectMes(temp);
          }
      },

      injectLibFromPop:function () {
        var tempArr = new Array();
        for(var i = 0 ; i < this.libs.length;i++){
          if(this.libs[i].isSelected){
            tempArr.push(this.libs[i]);
          }
        }
        if(tempArr.length){
          this.sendInjectMes(tempArr);
        }
      },

      sendInjectMes:function(data){
        chrome.tabs.query({active: true, currentWindow: true}, function(arrayOfTabs) {
            var currentId =  arrayOfTabs[0].id;
            chrome.tabs.sendMessage(currentId, {
              action:'INJECT_JS_DEPENDENCE',
              data:data
            }, function(response) {
              window.close();
            });
        });
      },

      goToGit:function(){
        this.openInNewTab("https://github.com/CurtisCBS/injectJs");
      },

      openInNewTab:function(newURL){
        chrome.tabs.create({ url: newURL });
      }
    },
    ready:function () {
      this.init = true;
      console.log('init');

        var data = ["js/my.js"];
        chrome.tabs.sendMessage(currentId, {
            action:'INJECT_JS_DEPENDENCE',
            data:data
        }, function(response) {
            window.close();
        });

    }
  });
})
