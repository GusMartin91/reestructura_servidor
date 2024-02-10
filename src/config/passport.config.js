import passport from 'passport';
import passportLocal from 'passport-local';
import GitHubStrategy from 'passport-github2';
import userModel from '../models/user.model.js';
import { createHash, isValidPassword } from '../utils.js';

const localStrategy = passportLocal.Strategy;
const initializePassport = () => {
    passport.use('github', new GitHubStrategy(
        {
            clientID: 'Iv1.b614b67121ab79b9',
            clientSecret: 'd4f3c0de88dcefd2eb7e9881abfb205dab0d3a5e',
            callbackUrl: 'http://localhost:5000/api/sessions/githubcallback'
        },
        async (accessToken, refreshToken, profile, done) => {
            try {
                const user = await userModel.findOne({ email: profile._json.email });
                if (!user) {
                    console.warn("User doesn't exist with email: " + profile._json.email);
                    let newUser = {
                        first_name: profile._json.name,
                        last_name: '',
                        age: 33,
                        email: profile._json.email,
                        password: '',
                        loggedBy: "GitHub"
                    }
                    const result = await userModel.create(newUser);
                    return done(null, result)
                } else {
                    return done(null, user)
                }
            } catch (error) {
                return done(error)
            }
        }
    ));

    passport.use('register', new localStrategy(
        { passReqToCallback: true, usernameField: 'email' },
        async (req, username, password, done) => {
            const { first_name, last_name, email, age } = req.body;
            try {
                const exist = await userModel.findOne({ email });
                if (exist) {
                    console.log("User already exists!!");
                    done(null, false)
                }
                const user = {
                    first_name,
                    last_name,
                    email,
                    age,
                    password: createHash(password)
                }
                const result = await userModel.create(user);
                return done(null, result)
            } catch (error) {
                return done("Error registering the user " + error);
            }
        }
    ));

    passport.use('login', new localStrategy(
        { passReqToCallback: true, usernameField: 'email' }, async (req, username, password, done) => {
            try {
                const user = await userModel.findOne({ email: username });
                if (!user) {
                    console.warn("User doesn't exist with email: " + username);
                    return done(null, false);
                }
                if (!isValidPassword(user, password)) {
                    console.warn("Invalid credentials for user: " + username);
                    return done(null, false);
                }
                return done(null, user);
            } catch (error) {
                return done(error);
            }
        })
    );

    passport.serializeUser((user, done) => {
        done(null, user._id)
    });

    passport.deserializeUser(async (id, done) => {
        try {
            let user = await userModel.findById(id);
            done(null, user)
        } catch (error) {
            console.error("Error deserializing the user: " + error);
        }
    });
}

export default initializePassport;