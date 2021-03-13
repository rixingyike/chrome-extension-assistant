package controllers

import (
	models "wemedia_assistant/models"
	"github.com/kataras/iris/v12"
	"github.com/go-xorm/xorm"
	"time"
)


type ConfigController struct{
	Ctx iris.Context
	Db *xorm.Engine
}

// curl http://localhost:8080/config/numlastfollow/toutiao
func (c *ConfigController) GetNumlastfollowBy(name string) Response {
	var res = Response{
		Message: "",
	}
	var num = 0
	todayTimeStr := time.Now().Format("2006-01-02")
	config := new(models.Config)
	if has, _ := c.Db.Where("`name` = ? and last_follow_date = ?", name,todayTimeStr).Get(config); has {
		num = config.NumLastFollow
	}
	
	res.Code = 1
	res.Data = num
	return res
}