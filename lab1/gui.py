import tkinter as tk
from tkinter import ttk, simpledialog, filedialog, messagebox
from functions import *
import time
import matplotlib.pyplot as plt

class WordDictionaryApp:
    def __init__(self, root):
        self.root = root
        self.root.title("Словарь")
        self.dictionary = {}


        frame = tk.Frame(root)
        frame.pack(pady=5)
        tk.Button(frame, text="Загрузить TXT", command=self.load_txt_file).pack(side=tk.LEFT, padx=5)
        tk.Button(frame, text="Загрузить RTF", command=self.load_rtf_file).pack(side=tk.LEFT, padx=5)
        tk.Button(frame, text="Сохранить словарь", command=self.save_dictionary).pack(side=tk.LEFT, padx=5)
        tk.Button(frame, text="?", command=self.show_help).pack(side=tk.RIGHT, padx=5)
        tk.Button(frame, text="Бенчмарк", command=self.run_benchmark).pack(side=tk.LEFT, padx=5)

        search_frame = tk.Frame(root)
        search_frame.pack(pady=5)
        tk.Label(search_frame, text="Поиск:").pack(side=tk.LEFT)
        self.search_var = tk.StringVar()
        self.search_var.trace_add("write", self.update_filter)
        tk.Entry(search_frame, textvariable=self.search_var).pack(side=tk.LEFT, padx=5)


        columns = ("Lexeme", "Word form", "Form freq", "Lexeme freq", "Morphology")
        self.tree = ttk.Treeview(root, columns=columns, show="headings")
        for col in columns:
            self.tree.heading(col, text=col)
            self.tree.column(col, width=100)
        self.tree.pack(expand=True, fill=tk.BOTH)

        self.tree.bind("<Double-1>", self.edit_morphology)


    def show_help(self):
        help_text = (
            "Словарь — справка\n\n"
            "1. Загрузка файлов:\n"
            "   • 'Загрузить TXT' — загрузка текстового файла\n"
            "   • 'Загрузить RTF' — загрузка RTF-файла\n\n"
            "2. Словарь:\n"
            "   • В таблице отображаются лексемы и их словоформы\n"
            "   • Частоты лексем и словоформ считаются автоматически\n\n"
            "3. Поиск:\n"
            "   • Введите текст в поле 'Поиск' для фильтрации словоформ\n\n"
            "4. Редактирование морфологии:\n"
            "   • Дважды щёлкните по строке, чтобы изменить морфологию\n\n"
            "5. Сохранение:\n"
            "   • 'Сохранить словарь' сохраняет данные в TXT-файл\n"
        )

        messagebox.showinfo("Справка", help_text)

    def load_txt_file(self):
        path = filedialog.askopenfilename(filetypes=[("Text files", "*.txt")])
        if path:
            text = load_txt(path)
            self.build_and_display_dictionary(text)

    def load_rtf_file(self):
        path = filedialog.askopenfilename(filetypes=[("RTF files", "*.rtf")])
        if path:
            text = load_rtf(path)
            self.build_and_display_dictionary(text)

    # def build_and_display_dictionary(self, text):
    #     self.dictionary = build_dictionary(text)
    #     self.display_dictionary()
    def build_and_display_dictionary(self, text):              # можно вынести в начало файла
        start_time = time.time()
        
        self.dictionary = build_dictionary(text)
        
        end_time = time.time()
        processing_time = end_time - start_time
        
        self.display_dictionary()
        
        # Показываем результат
        volume = len(text)
        messagebox.showinfo(
            "Обработка завершена",
            f"✅ Файл обработан!\n\n"
            f"Объём текста: {volume:,} символов\n"
            f"Время обработки: {processing_time:.2f} секунд\n"
            f"Скорость: {volume / processing_time:,.0f} символов/сек"
        )

    def display_dictionary(self, filter_text=""):
        for item in self.tree.get_children():
            self.tree.delete(item)

        for lex in sorted(self.dictionary.keys()):
            lex_data = self.dictionary[lex]
            for form, data in lex_data["forms"].items():
                if filter_text.lower() in form.lower():
                    self.tree.insert(
                        "", tk.END,
                        values=(lex, form, data["count"], lex_data["lexeme_freq"], data["morph"])
                    )

    def update_filter(self, *args):
        self.display_dictionary(self.search_var.get())

    def edit_morphology(self, event):
        item = self.tree.selection()
        if not item:
            return
        word = self.tree.item(item)["values"][1]  # Word form
        lex = self.tree.item(item)["values"][0]   # Lexeme
        current_morph = self.dictionary[lex]["forms"][word]["morph"]
        new_morph = simpledialog.askstring("Редактировать морфологию",
                                           f"Введите морфологическую информацию для '{word}':",
                                           initialvalue=current_morph)
        if new_morph is not None:
            self.dictionary[lex]["forms"][word]["morph"] = new_morph
            self.display_dictionary(self.search_var.get())

    def save_dictionary(self):
        path = filedialog.asksaveasfilename(defaultextension=".txt",
                                            filetypes=[("Text files", "*.txt")])
        if path:
            try:
                with open(path, "w", encoding="utf-8") as f:
                    for lex in sorted(self.dictionary.keys()):
                        lex_data = self.dictionary[lex]
                        for form, data in lex_data["forms"].items():
                            f.write(f"{lex}\t{form}\t{data['count']}\t{lex_data['lexeme_freq']}\t{data['morph']}\n")
                messagebox.showinfo("Сохранение", "Словарь успешно сохранён!")
            except Exception as e:
                messagebox.showerror("Ошибка", f"Не удалось сохранить файл:\n{e}")

    def run_benchmark(self):
    
        sample_text = (
            "The quick brown fox jumps over the lazy dog. "
            "This is a test sentence for performance evaluation of the NLP pipeline using spaCy model. "
            "Natural language processing is very resource intensive for large documents. "
        ) * 10
        
        volumes = [1_000, 5_000, 10_000, 25_000, 50_000, 100_000, 200_000] 
        times = []
        tokens_list = []  
        
        print("Запуск бенчмарка...")
        
        for vol in volumes:
            # Генерируем текст нужного объёма
            text = (sample_text * (vol // len(sample_text) + 1))[:vol]
            
            start = time.time()
            _ = build_dictionary(text)          # вызываем функцию напрямую
            end = time.time()
            
            times.append(end - start)
            # Примерное количество токенов (для справки)
            approx_tokens = len(text.split())
            tokens_list.append(approx_tokens)
            
            print(f"Объём {vol:,} симв. → {end-start:.2f} сек")
        
        # === Построение графика ===
        plt.figure(figsize=(10, 6))
        plt.plot(volumes, times, marker='o', linewidth=2, markersize=8, color='#1f77b4')
        plt.xlabel("Объём текста (символы)", fontsize=12)
        plt.ylabel("Время обработки (секунды)", fontsize=12)
        plt.title("Производительность приложения\n(зависимость от объёма текста)", fontsize=14)
        plt.grid(True, linestyle='--', alpha=0.7)
        
        # Дополнительные подписи точек
        for x, y in zip(volumes, times):
            plt.annotate(f"{y:.2f}s", (x, y), xytext=(5, 5), textcoords='offset points')
        
        plt.tight_layout()
        plt.show()
        
        # Дополнительно показываем таблицу в messagebox
        table = "Объём (симв.) | Время (сек) | Примерно токенов\n"
        table += "-" * 50 + "\n"
        for v, t, tok in zip(volumes, times, tokens_list):
            table += f"{v:>10,} | {t:>10.2f} | {tok:>15,}\n"
        
        messagebox.showinfo("Результаты бенчмарка", 
                            f"Бенчмарк завершён!\n\nГрафик открыт в отдельном окне.\n\n{table}")
