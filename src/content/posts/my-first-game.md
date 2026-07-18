---
title: 我做的第一个小游戏《暮色旅人》· My First Little Game
published: 2026-07-15
description: 用 three.js 做的一个黄昏徒步探索小游戏,附开发过程和踩坑记录。A twilight hiking game built with three.js.
image: "/images/twilight-road.jpg"
tags: [游戏开发, three.js, 作品]
category: 游戏作品
draft: false
---

> 这是一篇「游戏作品展示」板块的示例文章,替换成你自己的作品介绍就可以啦。
> This is a sample post for the *Games* section — replace it with your own project!

## 游戏介绍 · About the Game

《暮色旅人》是一个用 three.js 制作的第一人称徒步探索游戏:你沿着黄昏的山路行走,在天色完全暗下来之前找到营地。路上散落着可以拾取的「光」,收集它们能点亮营地的灯。

*You walk a mountain road at dusk, gathering scattered lights before night falls, to kindle the lanterns of your camp.*

## 玩法特色 · Features

- 🌄 **动态天色**:太阳落山的二十分钟里,天空从金橙过渡到深蓝
- 🏮 **拾光系统**:收集路边的光点,决定营地夜晚的亮度
- 🌌 **入夜后**:星空缓缓浮现,可以躺下来看星星结束一天

## 开发小记 · Dev Notes

:::tip[踩坑记录]
天色渐变最初用关键帧插值 RGB,结果暮色阶段发灰。换成在 oklch 色彩空间里插值后,蓝调时刻的层次一下子就出来了。
:::

天色插值的核心逻辑:

```javascript
// 在 oklch 空间插值,避免暮色阶段变灰
const sky = oklch.mix(duskColor, nightColor, t);
scene.fog.color.set(sky);
```

## 试玩 · Play

后续可以把试玩链接、录屏 GIF 放在这里。
