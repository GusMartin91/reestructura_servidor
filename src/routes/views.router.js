import { Router } from "express";
import productDao from '../daos/dbManager/product.dao.js';
import cookieParser from 'cookie-parser'

const router = Router()
router.use(cookieParser('TestS3cr3tC0d3'))

router.get('/', async (req, res) => {
    try {
        if (req.session && req.session.user) {
            res.redirect('/products');
        } else {
            res.render('login');
        }
    } catch (error) {
        console.log(error);
        res.json({
            message: "Error",
            error,
        });
    }
});

router.get('/logout', (req, res) => {
    req.session.destroy(error => {
        if (error) {
            return res.json({ error: 'Logout error', msg: "Error closing the session" });
        }
        setTimeout(() => {
            res.redirect('/users/login');
        }, 1000);
    });
});

router.get('/realtimeproducts', (req, res) => {
    res.render('realTimeProducts', {
        title: "realTimeProducts",
    });
}); router.get('/products', (req, res) => {
    res.render('products', {
        title: "products",
    });
});

router.get('/chat', (req, res) => {
    res.render('chat');
});

router.get('/login', (req, res) => {
    res.render('login');
});

router.get('/cart', (req, res) => {
    res.render('cart');
});

router.get('/realTimeProducts/:pid', async (req, res) => {
    try {
        const productId = req.params.pid;
        const product = await productDao.getProductById(productId)

        if (!product || product == '') return res.json({ message: "Product not found" })

        res.render('productDetails', { product });
    } catch (error) {
        console.log(error);
        res.json({
            message: "Error",
            error
        });
    }
});

function auth(req, res, next) {
    if (req.session.user === 'pepe' && req.session.admin) {
        return next()
    } else {
        return res.status(403).send("User not authorized to access this resource.");
    }
}

router.get('/private', auth, (req, res) => {
    res.send('If you are seeing this, you are authorized to access this resource!')
});
export default router;