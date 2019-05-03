const CryptoJS = require('crypto-js')
const {
  getLength,
  generateNextBlock,
  addBlock,
  addChain,
  getBlock,
  checkBlock,
  Block
} = require('./main')

function generateBlock(blockData, previousBlock) {
  const nextIndex = previousBlock.index + 1
  const nextTimeStamp = new Date().getTime()
  const nextHash = CryptoJS.SHA256(nextIndex + previousBlock.hash + nextTimeStamp + blockData) + ''
  return new Block(nextIndex, previousBlock.hash, nextTimeStamp, blockData, nextHash)
}

function printBlockChain() {
  let length = getLength(),
    blocks = []
  for(let i = 0; i < length; ++i) {
    blocks.push(getBlock(i))
  }
  console.table(blocks)
}

/*
addBlock(generateNextBlock('a'))
addBlock(generateNextBlock('b'))

console.log('区块链长度是', getLength())
console.log('起源块是', getBlock(0))

// 打印区块链
printBlockChain() 

let newBlock = generateNextBlock('c')
// 是否合法
console.log(checkBlock(newBlock)) 
*/

let aBlock = null;

addBlock(generateNextBlock('a'))
aBlock = getBlock(getLength() - 1)

addBlock(generateNextBlock('b'))
printBlockChain()

setTimeout(() => {
  let blockchain = [],
    newBlock = null
  
  newBlock = generateBlock('B', aBlock)
  blockchain.push(newBlock)
  newBlock = generateBlock('C', newBlock)
  blockchain.push(newBlock)

  addChain(blockchain)
  printBlockChain()
}, 1000)


