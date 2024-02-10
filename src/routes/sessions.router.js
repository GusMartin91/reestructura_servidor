import { Router } from 'express';
import userModel from '../models/user.model.js';
import { createHash, isValidPassword } from '../utils.js'
import passport from 'passport';

const router = Router();

router.get("/github", passport.authenticate('github', { scope: ['user:email'] }), async (req, res) => {
    { }
})

router.get("/githubcallback", passport.authenticate('github', { failureRedirect: '/github/error' }), async (req, res) => {
    try {
        const user = req.user;
        req.session.user = {
            name: `${user.first_name} ${user.last_name}`,
            email: user.email,
            age: user.age
        };
        req.session.admin = true;    
        res.redirect("/users");
    } catch (error) {
        console.error("Error in /githubcallback route: " + error);
        res.render("error", { error: "Hubo un error en la autenticación con GitHub" });
    }
})
router.get('/api/currentUser', (req, res) => {
    if (req.isAuthenticated()) {
        res.json({ email: req.session.user.email });
    } else {
        res.json(null);
    }
});

router.get('/current', (req, res) => {
    if (req.isAuthenticated()) {
        const user = req.user;
        res.status(200).json({
            name: `${user.first_name} ${user.last_name}`,
            email: user.email,
            age: user.age,
            role: user.role
        });
    } else {
        res.status(401).json({ error: 'Unauthorized' });
    }
});
router.post('/register', async (req, res) => {
    const { first_name, last_name, email, age, password } = req.body;
    const exist = await userModel.findOne({ email });
    if (exist) {
        return res.status(400).send({ status: 'error', message: "User already exists!" })
    }

    const user = {
        first_name,
        last_name,
        email,
        age,
        password: createHash(password)
    }

    const result = await userModel.create(user);
    res.status(200).send({ status: "success", message: "User created successfully with ID: " + result.id });
})

router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    const user = await userModel.findOne({ email });
    if (!user) return res.status(401).send({ status: 'error', error: "Incorrect credentials" })
    if (!isValidPassword(user, password)) return res.status(401).send({ status: 'error', error: "Incorrect credentials" })

    let role = user.role;
    if (email == "adminCoder@coder.com" && password == "adminCod3r123") {
        role = 'admin'
    }
    req.session.user = {
        name: `${user.first_name} ${user.last_name}`,
        email: user.email,
        age: user.age,
        role
    }

    res.status(200).json({ status: 'success' });
})
router.get('/logout', (req, res) => {
    req.session.destroy(error => {
        if (error) {
            res.json({ error: 'Error logout', msg: "Error al cerrar la sesión" })
        }
        res.redirect('/login');
    });
});

export default router;