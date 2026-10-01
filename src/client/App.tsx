import { Route, Routes } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Home } from "@/pages/Home";
import { Portfolio } from "@/pages/Portfolio";
import { PortfolioDetail } from "@/pages/PortfolioDetail";
import { Prompts } from "@/pages/Prompts";
import { Daily } from "@/pages/Daily";
import { Blog } from "@/pages/Blog";
import { BlogPost } from "@/pages/BlogPost";
import { About } from "@/pages/About";
import { Knowledge } from "@/pages/Knowledge";
import { Admin } from "@/pages/Admin";
import { NotFound } from "@/pages/NotFound";

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="portfolio" element={<Portfolio />} />
        <Route path="portfolio/:id" element={<PortfolioDetail />} />
        <Route path="prompts" element={<Prompts />} />
        <Route path="daily" element={<Daily />} />
        <Route path="blog" element={<Blog />} />
        <Route path="blog/:slug" element={<BlogPost />} />
        <Route path="about" element={<About />} />
        <Route path="knowledge" element={<Knowledge />} />
        <Route path="admin" element={<Admin />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
