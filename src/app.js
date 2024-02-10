import express from 'express'
import { password, db_name, PORT } from './env.js'
import mongoose from "mongoose";
import __dirname from './utils.js';
import handlebars from 'express-handlebars';
import Handlebars from "handlebars";
import { allowInsecurePrototypeAccess } from "@handlebars/allow-prototype-access";
import { Server } from 'socket.io'
import viewRouter from './routes/views.router.js'
import productsRouter from "./routes/products.router.js";
import cartsRouter from "./routes/carts.router.js";
import session from 'express-session'
import MongoStore from 'connect-mongo'
import sessionsRouter from './routes/sessions.router.js'
import usersViewRouter from './routes/users.views.router.js';
import messagesRouter from "./routes/messages.router.js";
import productDao from "./daos/dbManager/product.dao.js";
import messageDao from "./daos/dbManager/message.dao.js";
import cartDao from "./daos/dbManager/cart.dao.js";
import path from 'path';
import passport from 'passport';
import initializePassport from './config/passport.config.js'
import githubLoginViewRouter from './routes/github-login.views.router.js'

const app = express()

const MONGO_URL = `mongodb+srv://gusmartin91:${password}@ecommerce.o43oskf.mongodb.net/${db_name}?retryWrites=true&w=majority`
const httpServer = app.listen(PORT, () => console.log(`Server listening on port: ${PORT}`))
const socketServer = new Server(httpServer)
let userEmailApp;
app.use(express.json())
app.use(express.urlencoded({ extended: true }));

app.engine('hbs', handlebars.engine({
    extname: 'hbs',
    defaultLayout: 'main',
    handlebars: allowInsecurePrototypeAccess(Handlebars),
}));
app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.static(path.join(__dirname, 'public')));

app.use(session(
    {
        store: MongoStore.create({
            mongoUrl: MONGO_URL,
            ttl: 10 * 60
        }),
        secret: "TestS3cr3tC0d3",
        resave: false,
        saveUninitialized: true
    }
))

app.use((req, res, next) => {
    res.locals.loggedIn = req.session.user !== undefined;
    res.locals.userData = req.session.user || {};
    next();
});

initializePassport();
app.use(passport.initialize());
app.use(passport.session());

app.use('/', viewRouter)
app.use('/api/products', productsRouter);
app.use('/api/carts', cartsRouter);
app.use('/api/messages', messagesRouter);
app.use('/users', usersViewRouter)
app.use('/api/sessions', sessionsRouter)
app.use("/github", githubLoginViewRouter)


const connectMongoDB = async () => {
    try {
        await mongoose.connect(MONGO_URL)
            .then(() => console.log("Successfully connected to the database using Mongoose!!"))
            .catch((err) => console.log(err))
    } catch (error) {
        console.error("Could not connect to the database using Mongoose: " + error);
        process.exit();
    }
}
connectMongoDB();

socketServer.on('connection', async (socketClient) => {

    socketClient.on('messageRTP', async (email) => {
        userEmailApp = email
        console.log(userEmailApp);
        socketClient.emit('realTimeProducts', { products: await productDao.getAllProducts(), cart: await cartDao.getCartByUser(userEmailApp) });
    });


    socketClient.on('addProduct', async (newProduct) => {
        await productDao.createProduct(newProduct);
        socketServer.emit('realTimeProducts', { products: await productDao.getAllProducts(), cart: await cartDao.getCartByUser(userEmailApp) });
    });
    socketClient.on('filtrando', async (email) => {
        socketServer.emit('carroParaFiltro', { cart: await cartDao.getCartByUser(email) });
    });

    socketClient.on('editProduct', async ({ productId, editedProduct }) => {
        await productDao.updateProduct(productId, editedProduct);
        socketClient.emit('productDetails', { product: await productDao.getProductById(productId) });
        socketServer.emit('realTimeProducts', { products: await productDao.getAllProducts(), cart: await cartDao.getCartByUser(userEmailApp) });
    });

    socketClient.on('deleteProduct', async (productId) => {
        await productDao.deleteProduct(productId);
        socketServer.emit('realTimeProducts', { products: await productDao.getAllProducts(), cart: await cartDao.getCartByUser(userEmailApp) });
    });

    socketClient.on('userConnected', async (currentUserEmail) => {
        socketClient.broadcast.emit('newUserConnected', currentUserEmail);

        try {
            const chatHistory = await obtenerHistorialDeChats();
            socketClient.emit('chatHistory', chatHistory);
        } catch (error) {
            console.log('Error al obtener el historial de chats:', error.message);
            socketClient.emit('chatHistory', []);
        }
    });
    async function obtenerHistorialDeChats() {
        try {
            const chatHistory = await messageDao.getAllMessages();
            return chatHistory;
        } catch (error) {
            console.log('Error al obtener el historial de chats:', error.message);
            return [];
        }
    }

    socketClient.on('sendChatMessage', async ({ email, message }) => {
        const newMessage = {
            email,
            message,
            date: new Date(),
        };
        await messageDao.createMessage(newMessage);
        socketServer.emit('newChatMessage', newMessage);
    });

    let userEmail = ''
    socketClient.on('userCartAuth', async (currentUserEmail) => {
        userEmail = currentUserEmail
        const userCart = await cartDao.getCartByUser(userEmail);
        if (!userCart) {
            userCart = await cartDao.addToCart(userEmail, '', '')
        }
        const productsInfo = await Promise.all(userCart.products.map(async (product) => {
            const productInfo = await productDao.getProductById(product.productId);
            return {
                productId: product.productId,
                info: productInfo,
                quantity: product.quantity
            };
        }));
        socketClient.emit('productsCartInfo', productsInfo);
    });
    socketClient.on('addToCart', async ({ productId, currentUserEmail }) => {
        await cartDao.addToCart(currentUserEmail, productId, 1)
        socketClient.emit('realTimeProducts', { products: await productDao.getAllProducts(), cart: await cartDao.getCartByUser(currentUserEmail) });
    });

    socketClient.on('updateCart', async ({ productId, action }) => {
        userEmail = userEmail ? userEmail : userEmailApp
        const userCart = await cartDao.getCartByUser(userEmail);
        if (userCart) {
            const productIndex = userCart.products.findIndex((item) => item.productId._id.toString() === productId);
            if (productIndex !== -1) {
                const product = userCart.products[productIndex];
                switch (action) {
                    case 'add':
                        product.quantity++;
                        break;
                    case 'subtract':
                        if (product.quantity > 1) {
                            product.quantity--;
                        }
                        break;
                    default:
                        break;
                }
                await userCart.save();
                const productsInfo = await Promise.all(userCart.products.map(async (product) => {
                    const productInfo = await productDao.getProductById(product.productId);
                    return {
                        productId: product.productId,
                        info: productInfo,
                        quantity: product.quantity
                    };
                }));
                socketClient.emit('productsCartInfo', productsInfo);
                socketClient.emit('realTimeProducts', { products: await productDao.getAllProducts(), cart: await cartDao.getCartByUser(userEmail) });
            }
        }
    });

    socketClient.on('deleteFromCart', async ({ productId }) => {
        try {
            if (productId == null) {
                console.error("productId is null or undefined.");
                return;
            }

            await cartDao.removeFromCart(userEmailApp, productId);

            const updatedCart = await cartDao.getCartByUser(userEmailApp);
            const productsInfo = await Promise.all(updatedCart.products.map(async (product) => {
                const productInfo = await productDao.getProductById(product.productId._id.toString());
                return {
                    productId: product.productId._id.toString(),
                    info: productInfo,
                    quantity: product.quantity
                };
            }));

            socketClient.emit('productsCartInfo', productsInfo);
            socketClient.emit('realTimeProducts', { products: await productDao.getAllProducts(), cart: updatedCart });
        } catch (error) {
            console.error("Error handling deleteFromCart:", error.message);
        }
    });


    socketClient.on('clearCart', async () => {
        await cartDao.clearCart(userEmailApp);
        socketClient.emit('productsCartInfo', []);
    });
});

export { socketServer };