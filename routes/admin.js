const express = require('express');
const router = express.Router();
const puppeteer = require('puppeteer');
const cheerio = require('cheerio');

//Requiring product datamodel
const Product = require('../models/product');

//checks for user authentication
function isAuthenticatedUser(req,res,next){
    if(req.isAuthenticated()){
        return next();
    }
    req.flash('error_msg','Login first to access this page!');
    res.redirect('/login');
}

let browser;

async function scrapData(url,page){
    try {
        await page.goto(url,{waitUntil : 'load' , timeout :0});
        const html = await page.evaluate(()=>document.body.innerHTML);
        const $ = await cheerio.load(html);

        let title = $(' h1 > span ').text();
        let price = $('div._1vC4OE._3qQ9m1').text();
        
        let seller = '';
        let checkSeller = $('#sellerName > span > span');
        if(checkSeller){
            seller = checkSeller.text();
        }
        
        let outOfStock = $('div._1S11PY').text();
        if(!outOfStock){
            outOfStock = $('div._1HmYoV._35HD7C.col-8-12 > div:nth-child(3) > div').text();    
        }
        

        let deliveryNotAvailable = '';
        let checkDeliveryNotAvailable = $('div._2h4rON > ul > div > div');
        if(checkDeliveryNotAvailable){
                deliveryNotAvailable = checkDeliveryNotAvailable.text();
        }

        let stock = '';

        if((outOfStock.includes('Out of Stock'||'Coming Soon'||'Hurry, Only few left!')) || (deliveryNotAvailable.includes('Delivery not available'))){
            stock = 'Out Of Stock';
        }
        else {
            stock = 'In Stock!';
        }

        return {
            title,
            price,
            stock,
            url
        }


    } catch (error) {
        console.log(error);
    }
}

router.get('/product/new', isAuthenticatedUser, async (req, res)=> {
    try {
        let url = req.query.search;
        if(url) {
            browser = await puppeteer.launch({ args: ['--no-sandbox'] });
            const page = await browser.newPage();
            let result = await scrapData(url,page);

            let productData = {
                title : result.title,
                price : result.price,
                stock : result.stock,
                productUrl : result.url
            };
            res.render('./admin/newproduct', {productData : productData});
            browser.close();
        }
       else{
           let productData = {
            title : "",
            price : "",
            stock : "",
            productUrl : ""
           };
           res.render('./admin/newproduct',{productData : productData});
           browser.close();
       }
    } catch (error) {
       req.flash('error_msg','ERROR: '+error);
       res.redirect('/product/new');
    }
});


module.exports = router;