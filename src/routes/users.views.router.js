import { Router } from 'express';

const router = Router();


router.get("/login", (req, res) => {
    res.render('login')
})

router.get("/register", (req, res) => {
    res.render('register')
})

router.get("/", (req, res) => {
    if (!req.session.user) {
        return res.redirect("/users/login");
    }
    res.render('profile', {
        user: req.session.user
    });
});

export default router;