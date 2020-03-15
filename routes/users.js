const express=require('express');
const router=express.Router();
const passport=require('passport');
const crypto=require('crypto');
const async=require('async');
const nodemailer=require('nodemailer');


const User=require('../models/usermodel');//getting the user model!

//checks for user authentication
function isAuthenticatedUser(req,res,next){
    if(req.isAuthenticated()){
        return next();
    }
    req.flash('error_msg','Login first to access this page!');
    res.redirect('/login');
}

//Get routes
router.get('/login',(req,res)=>{
    res.render('./users/login');
});

router.get('/signup',(req,res)=>{
    res.render('./users/signup');
});

router.get('/dashboard',isAuthenticatedUser,(req,res)=>{
    res.render('./users/dashboard');
});

router.get('/logout',isAuthenticatedUser,(req,res)=>{
    req.logOut();
    req.flash('success_msg','You have logged out!!!');
    res.redirect('./users/login');
});

router.get('/forgot',(req,res)=>{
    res.render('.users/forgot');
});

router.get('/reset/:token',(req,res)=>{
    User.findOne({resetPasswordToken : req.params.token,resetPasswordExpires : {$gt :Date.now()}})
        .then(user =>{
            if(!user){
                req.flash('error_msg','password reset token is incorrect or it may have been expired!');
                res.redirect('.users/forgot');
            }
            res.render('./users/newpassword',{token : req.params.token});
        })
        .catch(err =>{
            req.flash('error_msg','ERROR :'+err);
            res.redirect('.users/forgot');
        })
});

router.get('/password/change',/*isAuthenticatedUser*/(req,res)=>{
    res.render('.users/changepassword');
});

router.get('/users/all',(req,res)=>{
    User.find({})
        .then(users =>{
            res.render('./users/allusers',{users : users});
        })
        .catch(err =>{
            console.log(err);
        })
});

//Post routes
router.post('/login',passport.authenticate('local',{
    successRedirect:'/dashboard',
    failureRedirect:'/login',
    failureFlash:'Invalid Username or Password.Please try again!!!'
}));

router.post('/signup',(req,res)=>{
    let {name,email,password} = req.body;

    let userData={
        name:name,
        email:email /*we are not setting the password key here because we don't want to show it */
    };
    User.register(userData,password,(err,user)=>{
        if(err){
            req.flash('error_msg','ERR: '+err);
            res.redirect('/signup');
        }
        req.flash('success_msg','Account Successfully Created!');
        res.redirect('/signup');
    });

});

//route for changepassword
router.post('/password/change',(req,res)=>{
    if(req.body.password!==req.body.confirmpassword){
        req.flash('error_msg',"Password doesn't match.Try again!");
        return res.redirect('/password/change');
    }
    User.findOne({email : req.user.email})
        .then(user =>{
            user.setPassword(req.body.password,err =>{
                user.save()
                    .then(user =>{
                        req.flash('success_msg','Password changed successfully!');
                        res.redirect('./dashboard');
                    })
                    .catch(err =>{
                        req.flash('error_msg','ERROR: '+err);
                        res.redirect('/password/change');
                    })
            })
        })
})

//routes forgot password
router.post('/forgot', (req, res, next)=> {
    let recoveryPassword = '';
    async.waterfall([
        (done) => {
            crypto.randomBytes(20, (err , buf) => {
                let token = buf.toString('hex');
                done(err, token);
            });
        },
        (token, done) => {
            User.findOne({email : req.body.email})
                .then(user => {
                    if(!user) {
                        req.flash('error_msg', 'User does not exist with this email.');
                        return res.redirect('/forgot');
                    }

                    user.resetPasswordToken = token;
                    user.resetPasswordExpires = Date.now() + 1800000; // 30 minutes

                    user.save(err => {
                        done(err, token, user);
                    });
                })
                .catch(err => {
                    req.flash('error_msg', 'ERROR: '+err);
                    res.redirect('/forgot');
                })
        },
        (token, user) => {
            let smtpTransport = nodemailer.createTransport({
                service: 'Gmail',
                auth: {
                    user : process.env.GMAIL_EMAIL,
                    pass: process.env.GMAIL_PASSWORD
                }
            });

            let mailOptions = {
                to: user.email,
                from : 'Aravindan aravindanravi33@gmail.com',
                subject : 'Recovery Email from Auth Project',
                text : 'Please click the following link to recover your password: \n\n'+
                        'http://'+ req.headers.host +'/reset/'+token+'\n\n'+
                        'If you did not request this, please ignore this email.'
            };
            smtpTransport.sendMail(mailOptions, err=> {
                req.flash('success_msg', 'Email send with further instructions. Please check that.');
                res.redirect('/forgot');
            });
        }

    ], err => {
        if(err) res.redirect('/forgot');
    });
});

router.post('/reset/:token',(req,res,next)=>{
    async.waterfall([
        (done)=>{
            User.findOne({resetPasswordToken : req.params.token,resetPasswordExpires : {$gt :Date.now()}})
            .then(user =>{
                if(!user){
                    req.flash('error_msg','password reset token is incorrect or it may have been expired!');
                    res.redirect('/forgot');
                }
                if(req.body.password!==req.body.confirmpassword){
                    req.flash('error_msg',"Password don't match!");
                    res.redirect('/forgot');
                }

                user.setPassword(req.body.password,err =>{
                    user.resetPasswordToken = undefined;
                    user.resetPasswordExpires = undefined;

                    user.save(err =>{
                        req.logIn(user,err =>{
                            done(err,user);
                        });
                    });
                });
            })
            .catch(err =>{
                req.flash('error_msg','ERROR :'+err);
                res.redirect('/forgot');
            });

        },

        (user)=>{
            let smtpTransport = nodemailer.createTransport({
                service : 'Gmail',
                auth : {
                    user : process.env.GMAIL_EMAIL,
                    pass : process.env.GMAIL_PASSWORD
                }
            });

            let mailOptions = {
                to : user.email,
                from : 'Aravindan aravindanravi33@gmail.com',
                subject:'Your password has been changed!',
                text : 'Hello '+user.name+'\n\n'+
                       'Your account password has been changed successfully for the account '+user.email
            };
              smtpTransport.sendMail(mailOptions,err =>{
                  req.flash('success_msg','Your password has been changed successfully!');
                  res.redirect('/login');
              });
        }
        
    ], err =>{
        res.redirect('/login');
    });
});

module.exports=router;