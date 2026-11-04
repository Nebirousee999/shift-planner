export type BlogArticle = {
  slug: string;
  title: string;
  description: string;
  date: string;
  readTime: string;
  content: React.ReactNode;
};

// Тексты статей (можно потом вынести в Markdown)
export const blogArticles = [
  {
    slug: "kak-sostavit-grafik-2-2",
    title: "Как составить график смен 2/2 и 3/3 на 2026 год",
    description: "Подробная инструкция, сколько смен в месяц при графике 2/2, как не нарушить ТК РФ и скачать готовый образец.",
    date: "05.11.2026",
    readTime: "5 мин",
  },
  {
    slug: "smennyj-grafik-po-tk-rf",
    title: "Сменный график по ТК РФ: ночные смены и перерывы",
    description: "Как оплачиваются ночные смены, сколько должен длиться перерыв между сменами и какие штрафы за нарушения.",
    date: "05.11.2026",
    readTime: "7 мин",
  },
  {
    slug: "grafik-smen-v-excel",
    title: "Как сделать график смен в Excel (и почему это устарело)",
    description: "Пошаговая инструкция по созданию таблицы в Excel, минусы этого метода и современная альтернатива.",
    date: "05.11.2026",
    readTime: "4 мин",
  },
  {
    slug: "zayavlenie-na-smenu-grafika",
    title: "Заявление на смену графика работы: образец 2026",
    description: "Как правильно оформить смену графика по инициативе работника или работодателя, скачать образец.",
    date: "05.11.2026",
    readTime: "6 мин",
  },
];
