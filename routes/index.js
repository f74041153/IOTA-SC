var express = require('express');
var router = express.Router();

const request = require('request')
const mam = require('@iota/mam')
const utils = require('../module/utils')
const {
  asciiToTrytes,
  trytesToAscii
} = require('@iota/converter')

const mode = 'restricted'
const provider = 'https://nodes.devnet.iota.org'

const sensor2url = {
  Farm: 'http://localhost:5000/CurrentRoot',
  Ship: 'http://localhost:5001/CurrentRoot'
}
const id2data = {}

let users = {
    farmer : {
        username : 'Mr.Wu',
        password : '1234',
        status : 'offline'
    }
}

let product_id_list = {
    farmer : []
}

const publish = async (mamState, data) => {
    let trytes = asciiToTrytes(JSON.stringify(data))
  
    const message = await mam.create(mamState, trytes)
    const depth = 3
    const minWeightMagnitude = 9
  
    try {
      mamState = message.state
      await mam.attach(message.payload, message.address, depth, minWeightMagnitude)
      return message
    } catch (error) {
      console.log('[Error] MAM', error)
      return null
    }
}
  

/* GET home page. */
router.get('/', function(req, res, next) {
    if(req.session.status != 'online'){
	    req.session.pid_list = []
        res.redirect('/login');
    }else{
        res.redirect('/list');
    }
});

router.get('/result', async function(req, res, next) {
    try {
        const product_id = req.query.product_id
        const product_data = id2data[product_id]
        mamState = mam.init(provider)
        await mam.fetch(product_data.product_root, mode, product_data.product_key, async (response) => {
          try {
            const data = JSON.parse(trytesToAscii(response))
            console.log(data)
          } catch (error) {
            console.log(error)
          }
        })
    } catch (error) {
        console.log(error)
    }
});

router.post('/start',async function(req, res, next){
    try {
        const key = utils.keyGen(81)
        mamState = mam.init(provider)
        mamState = mam.changeMode(mamState, mode, key)
    
        const product_id = req.body.pid
        const product_name = req.body.pname
        const farmer_name = req.body.username
        const sensor = req.body.sensor

	    req.session.pid_list.push(product_id)
	    console.log(req.session.pid_list);
    
        const options = {
          url: sensor2url['Farm'],
          method: 'GET'
        }
    
        const msg = await publish(mamState, req.body)
    
        const product_data = {
          product_name: product_name,
          product_root: msg.root,
          product_key: key,
          farmer_name: farmer_name,
          sensor: sensor,
          state: mamState
        }
    
        request(options, async (error, response, data) => {
          try {
    
            if (!error && response.statusCode == 200) {
              data = JSON.parse(data)
              product_data["sensor_root"] = data.root
              product_data["sensor_key"] = data.side_key
              id2data[product_id] = product_data
              console.log(product_data)
              res.send({
                  status : "success"
              });
            } else {
              console.log(error);
            }
   
          } catch (error) {
            console.log(error)
          }
        })
    
      } catch (error) {
        console.log(error)
        res.send({
          status: "fail"
        })
      }
});

router.get('/stop', async function(req, res, next) {
    try {
        const product_id = "123"
        const product_data = id2data[product_id]
        mamState = product_data.state
        console.log(product_data)
        await mam.fetch(product_data.sensor_root, mode, product_data.sensor_key, async (res) => {
          try {
            const data = JSON.parse(trytesToAscii(res))
            publish(mamState, data)
          } catch (error) {
            console.log(error)
          }
        })
        res.send({
          status: 'success',
          product_id: product_id,
          product_name: product_data.product_name,
          product_root: product_data.product_root,
          product_key: product_data.product_key,
          farmer_name: product_data.farmer_name
        })
      } catch (error) {
        console.log(error)
        res.send({
          status: "fail"
        })
      }
});

router.get('/login', function(req, res, next) {
    users['farmer'].status = 'online'
    req.session.status='online';
    res.render('login', { title: 'Express' });
});

router.get('/form', function(req, res, next) {
    res.render('form', { title: 'Express' });
});

router.get('/list', function(req, res, next) {
    res.render('list', { data: req.session.pid_list });
});
module.exports = router;
