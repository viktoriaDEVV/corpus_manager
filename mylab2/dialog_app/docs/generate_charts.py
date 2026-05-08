import matplotlib.pyplot as plt
import numpy as np

results = [
    {"name": "Приветствие", "intent_ms": 0.3, "entity_ms": 0.2, "response_ms": 0.5, "total_ms": 1.0},
    {"name": "Справка", "intent_ms": 0.4, "entity_ms": 0.2, "response_ms": 0.8, "total_ms": 1.4},
    {"name": "Статистика", "intent_ms": 0.5, "entity_ms": 0.3, "response_ms": 25.0, "total_ms": 25.8},
    {"name": "Документы", "intent_ms": 0.4, "entity_ms": 0.2, "response_ms": 15.0, "total_ms": 15.6},
    {"name": "Поиск", "intent_ms": 0.6, "entity_ms": 0.4, "response_ms": 180.0, "total_ms": 181.0},
    {"name": "Персонаж", "intent_ms": 0.5, "entity_ms": 0.3, "response_ms": 350.0, "total_ms": 350.8},
    {"name": "Тема", "intent_ms": 0.5, "entity_ms": 0.3, "response_ms": 420.0, "total_ms": 420.8},
    {"name": "Автор", "intent_ms": 0.4, "entity_ms": 0.2, "response_ms": 280.0, "total_ms": 280.6},
    {"name": "Очистка", "intent_ms": 0.3, "entity_ms": 0.2, "response_ms": 0.4, "total_ms": 0.9},
]

names = [r["name"] for r in results]
total_times = [r["total_ms"] for r in results]

fig, ax = plt.subplots(figsize=(12, 6))
colors = plt.cm.Blues(np.linspace(0.4, 0.9, len(names)))
bars = ax.bar(names, total_times, color=colors, edgecolor='navy', linewidth=1.2)

for bar, val in zip(bars, total_times):
    ax.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 5,
            f'{val:.1f}', ha='center', va='bottom', fontsize=10, fontweight='bold')

ax.set_xlabel('Тип запроса', fontsize=12, fontweight='bold')
ax.set_ylabel('Время выполнения (мс)', fontsize=12, fontweight='bold')
ax.set_title('Быстродействие диалоговой системы\n(время отклика по типам запросов)', fontsize=14, fontweight='bold')
ax.grid(axis='y', alpha=0.3, linestyle='--')
ax.set_ylim(0, max(total_times) * 1.15)
plt.xticks(rotation=30, ha='right')
plt.tight_layout()
plt.savefig('benchmark_chart.png', dpi=150, bbox_inches='tight')
print("Сохранён: benchmark_chart.png")
plt.close()

intent_times = [r["intent_ms"] for r in results]
entity_times = [r["entity_ms"] for r in results]
response_times = [r["response_ms"] for r in results]

fig, ax = plt.subplots(figsize=(12, 6))
x = np.arange(len(names))
width = 0.25

ax.bar(x - width, intent_times, width, label='Классификация намерений', color='#3498db', edgecolor='navy')
ax.bar(x, entity_times, width, label='Извлечение сущностей', color='#2ecc71', edgecolor='darkgreen')
ax.bar(x + width, response_times, width, label='Генерация ответа', color='#e74c3c', edgecolor='darkred')

ax.set_xlabel('Тип запроса', fontsize=12, fontweight='bold')
ax.set_ylabel('Время (мс)', fontsize=12, fontweight='bold')
ax.set_title('Детализация времени обработки по этапам', fontsize=14, fontweight='bold')
ax.set_xticks(x)
ax.set_xticklabels(names, rotation=30, ha='right')
ax.legend(loc='upper right')
ax.grid(axis='y', alpha=0.3, linestyle='--')
ax.set_yscale('log')
plt.tight_layout()
plt.savefig('benchmark_detailed.png', dpi=150, bbox_inches='tight')
print("Сохранён: benchmark_detailed.png")
plt.close()

print("\n=== ИТОГИ ===")
total_avg = sum(r["total_ms"] for r in results) / len(results)
print(f"Среднее время: {total_avg:.1f} мс")
print(f"Мин: {min(total_times):.1f} мс, Макс: {max(total_times):.1f} мс")