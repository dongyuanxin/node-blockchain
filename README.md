# [NodeJS实现简易区块链](https://godbmw.com/passages/2019-05-02-node-block-chain/)

之前由于课程要求，基于Nodejs做了一个实现简易区块链。要求非常简单，结构体记录区块结构，顺便能向链中插入新的区块即可。

但是如果要支持多用户使用，就需要考虑“可信度”的问题。那么按照区块链要求，链上的数据不能被篡改，除非算力超过除了攻击者本身之外其余所以机器的算力。

想了想，就动手做试试咯。

[🔍**查看全部教程**](https://github.com/dongyuanxin/blog) / [**阅读原文**🔍](https://godbmw.com/passages/2019-05-02-node-block-chain/)

## 技术调研

在google上搜了搜，发现有个项目不错： [https://github.com/lhartikk/naivechain](https://github.com/lhartikk/naivechain) 。大概只有200行，但是其中几十行都是关于搭建ws和http服务器，美中不足的是没有实现批量插入区块链和计算可信度。

结合这个项目，基本上可以确定每个区块会封装成一个class（结构化表示），区块链也封装成一个class，再对外暴露接口。


## 区块定义

为了方便表示区块，将其封装为一个class，它没有任何方法：

```javascript
/**
 * 区块信息的结构化定义
 */
class Block {
  /**
   * 构造函数
   * @param {Number} index 
   * @param {String} previousHash 
   * @param {Number} timestamp 
   * @param {*} data 
   * @param {String} hash 
   */
  constructor(index, previousHash, timestamp, data, hash) {
    this.index = index // 区块的位置
    this.previousHash = previousHash + '' // 前一个区块的hash
    this.timestamp = timestamp // 生成区块时候的时间戳
    this.data = data // 区块本身携带的数据
    this.hash = hash + '' // 区块根据自身信息和规则生成的hash
  }
}
```

至于怎么生成hash，这里采用的规则比较简单：

1. 拼接index、previouHash、timestamp和data，将其字符串化
1. 利用sha256算法，计算出的记过就是hash

为了方便，会引入一个加密库：

```javascript
const CryptoJS = require('crypto-js')
```


## 链结构定义
很多区块链接在一起，就组成了一条链。这条链，也用class来表示。并且其中实现了很多方法：

1. 按照加密规则生成hash
1. 插入新块和检查操作
1. 批量插入块和检查操作以及可信度计算


### 1. 起源块

起源块是“硬编码”，因为它前面没数据呀。并且规定它不能被篡改，即不能强制覆盖。我们在构造函数中，直接将生成的起源块放入链中。

```javascript
class BlockChain {
  constructor() {
    this.blocks = [this.getGenesisBlock()]
  }

  /**
   * 创建区块链起源块, 此块是硬编码
   */
  getGenesisBlock() {
    return new Block(0, '0', 1552801194452, 'genesis block', '810f9e854ade9bb8730d776ea02622b65c02b82ffa163ecfe4cb151a14412ed4')
  }
}
```


### 2. 计算下一个区块

BlockChain对象可以根据当前链，自动计算下一个区块。并且与用户传来的区块信息比较，如果一样，说明合法，可以插入；否则，用户的区块就是非法的，不允许插入。

```javascript
// 方法都是BlockChain对象方法
  /**
   * 根据信息计算hash值
   */
  calcuteHash(index, previousHash, timestamp, data) {
    return CryptoJS.SHA256(index + previousHash + timestamp + data) + ''
  }

  /**
   * 得到区块链中最后一个块节点
   */
  getLatestBlock() {
    return this.blocks[this.blocks.length - 1]
  }

  /**
   * 计算当前链表的下一个区块
   * @param {*} blockData 
   */
  generateNextBlock(blockData) {
    const previousBlock = this.getLatestBlock()
    const nextIndex = previousBlock.index + 1
    const nextTimeStamp = new Date().getTime()
    const nextHash = this.calcuteHash(nextIndex, previousBlock.hash, nextTimeStamp, blockData)
    return new Block(nextIndex, previousBlock.hash, nextTimeStamp, blockData, nextHash)
  }
```


### 3. 插入区块

插入区块的时候，需要检查当前块是否合法，如果合法，那么插入并且返回true；否则返回false。

```javascript
  /**
   * 向区块链添加新节点
   * @param {Block} newBlock 
   */
  addBlock(newBlock) {
    // 合法区块
    if(this.isValidNewBlock(newBlock, this.getLatestBlock())) {
      this.blocks.push(newBlock)
      return true  
    }
    return false
  }
```

检查的逻辑就就放在了 `isValidNewBlock` 方法中, 它主要完成3件事情：

1. 判断新区块的index是否是递增的
1. 判断previousHash是否和前一个区块的hash相等
1. 判断新区块的hash是否按约束好的规则生成

```javascript
  /**
   * 判断新加入的块是否合法
   * @param {Block} newBlock 
   * @param {Block} previousBlock 
   */
  isValidNewBlock(newBlock, previousBlock) {
    if(
      !(newBlock instanceof Block) ||
      !(previousBlock instanceof Block)
    ) {
      return false
    }

    // 判断index
    if(newBlock.index !== previousBlock.index + 1) { 
      return false
    }

    // 判断hash值
    if(newBlock.previousHash !== previousBlock.hash) { 
      return false
    }

    // 计算新块的hash值是否符合规则
    if(this.calcuteHash(newBlock.index, newBlock.previousHash, newBlock.timestamp, newBlock.data) !== newBlock.hash) { 
      return false
    }

    return true
  }
```


### 4. 批量插入

批量插入的逻辑比较复杂，比如当前链上有4个区块的下标是：0->1->2->3。除了起源块0不能被覆盖，当插入一条新的下标为“1->2->3->4”的链时候，就可以替换原来的区块。最终结果是：0->1->2->3->4。

在下标index的处理上，假设还是上面的情况，如果传入的链的下标是从大于4的整数开始，显然无法拼接原来的区块链的下标，直接扔掉。

但是如何保证可信度呢？就是当新链（B链）替换原来的链（A链）后，生成新的链（C链）。如果 length(C) > length(A)，那么即可覆盖要替换的部分。 **这就保证了，只有在算力超过所有算力50%的时候，才能篡改这条链** 。

插入新链的方法如下：
```javascript
  /**
   * 插入新链表
   * @param {Array} newChain 
   */
  addChain(newChain) {
    if(this.isValidNewChain(newChain)) {
      const index = newChain[0].index
      this.blocks.splice(index)
      this.blocks = this.blocks.concat(newChain)
      return true
    }
    return false
  }
```

实现上面所述逻辑的方法如下：

```javascript
  /**
   * 判断新插入的区块链是否合法而且可以覆盖原来的节点
   * @param {Array} newChain 
   */
  isValidNewChain(newChain) {
    if(Array.isArray(newChain) === false || newChain.length === 0) {
      return false
    }

    let newChainLength = newChain.length,
      firstBlock = newChain[0]

    // 硬编码的起源块不能改变
    if(firstBlock.index === 0) {
      return false
    }

    // 移植新的链的长度 <= 现有链的长度
    // 新的链不可信
    if(newChainLength + firstBlock.index <= this.blocks.length) {
      return false
    }

    // 下面检查新的链能否移植
    // 以及新的链的每个节点是否符合规则
    if(!this.isValidNewBlock(firstBlock, this.blocks[firstBlock.index - 1])) {
      return false
    }

    for(let i = 1; i < newChainLength; ++i) {
      if(!this.isValidNewBlock(newChain[i], newChain[i - 1])) {
        return false
      }
    }

    return true
  }
```

### 5. 为什么需要批量插入？

我当时很奇怪，为什么需要“批量插入”这个方法。后来想明白了（希望没想错）。假设服务器S，以及两个用户A与B。

A与B同时拉取到已知链的数据，然后各自生成。A网速较快，但是算力低，就生成了1个区块，放入了S上。注意：此时S上的区块已经更新。

而B比较惨了，它在本地生成了2个区块，但是受限于网速，只能等网速恢复了传入区块。这时候，按照规则，它是可以覆盖的（算力高嘛）。所以这种情况下，服务器S接受到B的2个区块，更新后的链长度是3（算上起源块），并且A的那个区块已经被覆盖了。


## 效果测试

虽然没有写服务器，但是还是模拟了上面讲述的第5种情况。代码在 `test.js` 文件中，直接run即可。看下效果截图吧：

![image.png](https://cdn.nlark.com/yuque/0/2019/png/233327/1556860848657-fa0a6f9c-1c6f-4494-b8eb-686a1f60b5c8.png#align=left&display=inline&height=369&name=image.png&originHeight=461&originWidth=1745&size=88863&status=done&width=1396)

红线上面就是先算出来的，红线下面就是被算力更高的客户端篡改后的区块链。具体模拟过程可以看代码，这里不再冗赘了。

全部代码在都放在： [https://github.com/dongyuanxin/node-blockchain](https://github.com/dongyuanxin/node-blockchain) 

## 更多系列文章

[⭐在GitHub上收藏/订阅⭐](https://github.com/dongyuanxin/blog)

《前端知识体系》
- [JavaScript基础知识梳理(上)](https://godbmw.com/passages/2019-03-26-javascript-first/)
- [JavaScript基础知识梳理(下)](https://godbmw.com/passages/2019-03-27-javascript-second/)
- [ES6重难点整理](https://godbmw.com/passages/2019-04-09-es6/)
- [谈谈promise/async/await的执行顺序与V8引擎的BUG](https://godbmw.com/passages/2018-05-29-promise-async-await-order/)
- [前端面试中常考的源码实现](https://godbmw.com/passages/2019-03-18-interview-js-code/)
- [Flex上手与实战](https://godbmw.com/passages/2019-03-20-css3-flex/)
- ......

《设计模式手册》
- [单例模式](https://godbmw.com/passages/2018-10-23-singleton-pattern/)
- [策略模式](https://godbmw.com/passages/2018-10-25-stragegy-pattern/)
- [代理模式](https://godbmw.com/passages/2018-11-01-proxy-pattern/)
- [迭代器模式](https://godbmw.com/passages/2018-11-06-iter-pattern/)
- [订阅-发布模式](https://godbmw.com/passages/2018-11-18-publish-subscribe-pattern/)
- [桥接模式](https://godbmw.com/passages/2019-01-19-bridge-pattern/)
- [备忘录模式](https://godbmw.com/passages/2019-01-26-memento-pattern/)
- [模板模式](https://godbmw.com/passages/2019-01-31-template-pattern/)
- [抽象工厂模式](https://godbmw.com/passages/2019-04-01-abstract-factory-pattern/)
- ......

《Webpack4渐进式教程》
- [webpack4 系列教程(二): 编译 ES6](https://godbmw.com/passages/2018-07-31-webpack-compile-es6/)
- [webpack4 系列教程(三): 多页面解决方案--提取公共代码](https://godbmw.com/passages/2018-08-06-webpack-mutiple-pages/)
- [webpack4 系列教程(四): 单页面解决方案--代码分割和懒加载](https://godbmw.com/passages/2018-08-08-webpack-spa-split-lazy/)
- [webpack4 系列教程(五): 处理 CSS](https://godbmw.com/passages/2018-08-17-webpack-css/)
- [webpack4 系列教程(八): JS Tree Shaking](https://godbmw.com/passages/2018-09-01-js-tree-shaking/)
- [webpack4 系列教程(十二)：处理第三方 JavaScript 库](https://godbmw.com/passages/2018-10-09-webpack-js-pacakge/)
- [webpack4 系列教程(十五)：开发模式与 webpack-dev-server](https://godbmw.com/passages/2018-10-19-webpack-dev-server/)
- ......

[⭐在GitHub上收藏/订阅⭐](https://github.com/dongyuanxin/blog)
