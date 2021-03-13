package models

// 头条用户
type ToutiaoUser struct {
	// 如果field名称为Id而且类型为int64并且没有定义tag，则会被xorm视为主键，并且拥有自增属性
	Id int64 `json:"id"`
	Uid int64 `json:"uid" xorm:"index unique 'uid'"` //头条用户id，一串数字
	Name string `json:"name"`
	Link string `json:"link"`
	Desc string `json:"desc"`
	CreatedAt int64 `json:"created_at" xorm:"created"`
	// 在Insert(), InsertOne(), Update()方法被调用时，updated标记的字段将会被自动更新为当前时间
	UpdatedAt int64 `json:"updated_at" xorm:"updated"`
	// 互动值，默认关注了就给 5 个互动值
	InteractiveValue int  `json:"interactive_value"`//
	// 状态，-1= 已拉黑，0=未关，1=已关注，2=互关
	State int `json:"state" xorm:"default 0 'state'"` 
	IsQingYun int `json:"is_qing_yun" xorm:"is_qing_yun"` //是否青云作者,0=否，1=问答青云
}