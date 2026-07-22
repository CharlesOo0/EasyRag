import { Link, useNavigate } from "react-router";
import { motion } from "framer-motion";
import { Rocket, Shield, Zap, CheckCircle, ArrowRight, Github, Play, Languages, LogOut, User as UserIcon } from "lucide-react";
import demoVideo from "../assets/demo.mp4";
import { useTranslation } from "react-i18next";
import { useAuth } from "~/context/auth-context";
import { useLogout } from "~/features/auth/hooks";

/**
 * Home page modern and slick showcase.
 */
export default function Home() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const logoutMutation = useLogout();

  const handleLogout = () => {
    logoutMutation.mutate(undefined, {
      onSuccess: () => navigate("/"),
    });
  };

  const toggleLanguage = () => {
    const newLang = i18n.language === 'fr' ? 'en' : 'fr';
    i18n.changeLanguage(newLang);
  };

  const fadeIn = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.6 }
  };

  const staggerContainer = {
    animate: {
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  return (
    <div className="w-full min-h-screen flex flex-col bg-background text-foreground font-sans">
      {/* Navbar */}
      <nav className="fixed top-0 w-full z-50 border-b bg-background/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link to="/" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <Rocket className="w-5 h-5 text-primary-foreground" />
              </div>
              <span className="text-xl font-bold tracking-tight">SaaSify</span>
            </Link>

            {/* Desktop Nav */}
            <div className="hidden md:flex items-center gap-8 text-sm font-medium">
              <a href="#" className="hover:text-primary transition-colors">{t('common.features')}</a>
              <a href="#" className="hover:text-primary transition-colors">{t('common.pricing')}</a>
              <a href="#" className="hover:text-primary transition-colors">{t('common.about')}</a>
            </div>

            <div className="flex items-center gap-4">
              <button 
                onClick={toggleLanguage}
                className="p-2 rounded-full hover:bg-secondary transition-colors"
              >
                <Languages className="w-5 h-5" />
              </button>
              
              {user ? (
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-secondary/50 rounded-full">
                    <UserIcon className="w-4 h-4 text-primary" />
                    <span className="text-sm font-medium">{user.username || user.email}</span>
                  </div>
                  <button 
                    onClick={handleLogout}
                    className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-destructive transition-colors cursor-pointer"
                  >
                    <LogOut className="w-4 h-4" />
                    <span className="hidden sm:inline">{t('common.logout')}</span>
                  </button>
                </div>
              ) : (
                <>
                  <Link to="/auth/login" className="text-sm font-medium hover:text-primary transition-colors">
                    {t('common.login')}
                  </Link>
                  <Link 
                    to="/auth/register" 
                    className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    {t('common.getStarted')}
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      <main className="flex-1 pt-16">
        {/* Hero Section */}
        <section className="relative overflow-hidden py-24 lg:py-32">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <motion.div 
              className="text-center"
              initial="initial"
              animate="animate"
              variants={staggerContainer}
            >
              <motion.h1 
                variants={fadeIn}
                className="text-4xl font-extrabold tracking-tight sm:text-6xl lg:text-7xl mb-6"
              >
                {user ? t('common.welcome', { name: user.username || user.email }) : t('home.hero.title')}
              </motion.h1>
              
              <motion.p 
                variants={fadeIn}
                className="max-w-2xl mx-auto text-lg text-muted-foreground mb-10"
              >
                {t('home.hero.subtitle')}
              </motion.p>
              
              {!user && (
                <motion.div 
                  variants={fadeIn}
                  className="flex flex-col sm:flex-row justify-center gap-4"
                >
                  <Link 
                    to="/auth/register"
                    className="inline-flex items-center justify-center rounded-lg bg-primary px-8 py-3 text-base font-medium text-primary-foreground shadow-lg transition-all hover:bg-primary/90 hover:scale-105"
                  >
                    {t('common.getStarted')}
                    <ArrowRight className="ml-2 w-5 h-5" />
                  </Link>
                  <a 
                    href="#demo"
                    className="inline-flex items-center justify-center rounded-lg border bg-background px-8 py-3 text-base font-medium shadow-sm transition-all hover:bg-accent hover:text-accent-foreground"
                  >
                    <Play className="mr-2 w-4 h-4 fill-current" />
                    {t('common.demo')}
                  </a>
                </motion.div>
              )}
            </motion.div>
          </div>

          {/* Background Decorative Elements */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full -z-10 pointer-events-none">
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-[120px]" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-primary/10 rounded-full blur-[120px]" />
          </div>
        </section>

        {/* Demo Video Section */}
        <section id="demo" className="py-24 relative overflow-hidden">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
              className="relative aspect-video rounded-3xl overflow-hidden border bg-card shadow-2xl"
            >
              <div className="absolute inset-0 bg-gradient-to-tr from-primary/10 via-transparent to-primary/5 pointer-events-none" />
              
              {/* Vidéo de démonstration */}
              <video
                src={demoVideo}
                className="absolute inset-0 w-full h-full object-cover"
                autoPlay
                loop
                muted
                playsInline
              />
            </motion.div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="py-24 bg-secondary/30">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-4">
                {t('home.featuresSection.title')}
              </h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                {t('home.featuresSection.subtitle')}
              </p>
            </div>

            <motion.div 
              className="grid grid-cols-1 md:grid-cols-3 gap-8"
              initial="initial"
              whileInView="animate"
              viewport={{ once: true }}
              variants={staggerContainer}
            >
              {[
                {
                  title: t('home.featuresSection.items.performance.title'),
                  description: t('home.featuresSection.items.performance.description'),
                  icon: <Zap className="w-6 h-6 text-primary" />,
                },
                {
                  title: t('home.featuresSection.items.security.title'),
                  description: t('home.featuresSection.items.security.description'),
                  icon: <Shield className="w-6 h-6 text-primary" />,
                },
                {
                  title: t('home.featuresSection.items.deployment.title'),
                  description: t('home.featuresSection.items.deployment.description'),
                  icon: <CheckCircle className="w-6 h-6 text-primary" />,
                }
              ].map((feature, idx) => (
                <motion.div 
                  key={idx}
                  variants={fadeIn}
                  className="p-8 bg-card border rounded-2xl shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-6">
                    {feature.icon}
                  </div>
                  <h3 className="text-xl font-semibold mb-3">{feature.title}</h3>
                  <p className="text-muted-foreground">
                    {feature.description}
                  </p>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t py-12 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-8">
            <Link to="/" className="flex items-center gap-2">
              <div className="w-6 h-6 bg-primary rounded flex items-center justify-center">
                <Rocket className="w-4 h-4 text-primary-foreground" />
              </div>
              <span className="text-lg font-bold">SaaSify</span>
            </Link>

            <div className="flex items-center gap-4">
              <a
                  rel="noreferrer"
                  target="_blank"
                  href="https://github.com/CharlesOo0" className="text-muted-foreground hover:text-foreground transition-colors">
                <Github className="w-5 h-5" />
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
