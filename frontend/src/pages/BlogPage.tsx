import { Link } from "react-router-dom";
import { BookOpen, ArrowRight } from "lucide-react";
import { blogArticles } from "../data/blogData";
import LandingHeader from "../components/landing/LandingHeader";
import LandingFooter from "../components/landing/LandingFooter";

export default function BlogPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <LandingHeader />
      <main className="max-w-4xl mx-auto px-4 py-12 sm:py-20">
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-brand-100 text-brand-600 mb-4">
            <BookOpen className="w-8 h-8" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">База знаний</h1>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            Полезные статьи о составлении графиков смен, трудовом законодательстве и кадровом учете.
          </p>
        </div>

        <div className="grid gap-6">
          {blogArticles.map((article) => (
            <Link 
              key={article.slug} 
              to={`/blog/${article.slug}`}
              className="group bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:shadow-md hover:border-brand-300 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div>
                <h2 className="text-xl font-semibold text-slate-900 mb-2 group-hover:text-brand-600 transition-colors">
                  {article.title}
                </h2>
                <p className="text-slate-600 text-sm mb-4 line-clamp-2">{article.description}</p>
                <div className="text-xs text-slate-400 font-medium">
                  {article.date} · {article.readTime}
                </div>
              </div>
              <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center shrink-0 group-hover:bg-brand-50 transition-colors">
                <ArrowRight className="w-5 h-5 text-slate-400 group-hover:text-brand-600" />
              </div>
            </Link>
          ))}
        </div>
      </main>
      <LandingFooter />
    </div>
  );
}
