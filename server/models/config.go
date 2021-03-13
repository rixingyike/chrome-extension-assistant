package models

type Config struct{
	Id int64 `json:"id"`
	Name string `xorm:"index"`
	LastFollowDate string //最新关注日期，按零点记录
	NumLastFollow int //头条每日限关注200
}