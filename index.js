require("@babel/polyfill")
const grpc = require('@grpc/grpc-js')
const protoLoader = require('@grpc/proto-loader')
const CryptoJS = require('crypto-js')
const { createClient } = require('grpc-js-kit')
const { promisify } = require('util')
const { QRLPROTO_SHA256 } = require('@theqrl/qrl-proto-sha256')
const tmp = require('tmp')
const fs = require('fs')
const util = require('util')
const readFile = util.promisify(fs.readFile)
const writeFile = util.promisify(fs.writeFile)
const PROTO_PATH = 'node_modules/@theqrl/qrlbase.proto/qrlbase.proto'
let qrlClient = null

function clientGetNodeInfo (client) {
  try {
    return new Promise((resolve, reject) => {
      client.getNodeInfo({}, (error, response) => {
        if (error) {
          reject(error)
        }
        resolve(response)
      })
    })
  } catch (error) {
    console.log(error)
  }
}

function checkProtoHash(file) {
  return readFile(file).then(contents => {
    const protoFileWordArray = CryptoJS.lib.WordArray.create(contents.toString())
    const calculatedProtoHash = CryptoJS.SHA256(protoFileWordArray).toString(CryptoJS.enc.Hex)
    console.log('calculatedProtoHash: ' + calculatedProtoHash)
  })
}

function loadGrpcBaseProto(grpcEndpoint) {
  return protoLoader.load(PROTO_PATH, {}).then(async packageDefinition => {
    const packageObject = grpc.loadPackageDefinition(packageDefinition)
    const client = await new packageObject.qrl.Base(grpcEndpoint, grpc.credentials.createInsecure())
    const res = await clientGetNodeInfo(client)
    console.log('version: ' + res.version)
    const qrlProtoFilePath = tmp.fileSync({mode: '0644', prefix: 'qrl-', postfix: '.proto'}).name
    writeFile(qrlProtoFilePath, res.grpcProto).then(fsErr => {
      if (fsErr) {
        throw new TypeError('tmp filesystem error')
      }
    })
    return qrlProtoFilePath
  })
} 

async function loadGrpcProto(protofile, endpoint) {
  const options = {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
  }
  const packageDefinition = await protoLoader.load(protofile, options)
  const grpcObject = await grpc.loadPackageDefinition(packageDefinition)
  const grpcObjectString = JSON.stringify(grpcObject.qrl)
  const protoObjectWordArray = CryptoJS.lib.WordArray.create(grpcObjectString)
  const calculatedObjectHash = CryptoJS.SHA256(protoObjectWordArray).toString(CryptoJS.enc.Hex)
  console.log('objectHash: ' + calculatedObjectHash)
}

async function makeClient (grpcEndpoint) {
  const proto = await loadGrpcBaseProto(grpcEndpoint)
  const validHash = await checkProtoHash(proto)
  const client = await loadGrpcProto(proto, grpcEndpoint)
}

let endpoint = 'mainnet-1.automated.theqrl.org:19009'

var myArgs = process.argv.slice(2)
if (myArgs.length > 0) {
  endpoint = myArgs[0]
}

console.log('Generating hashes for ' + endpoint)
makeClient(endpoint)

