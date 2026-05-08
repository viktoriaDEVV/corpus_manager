import requests
import time
import matplotlib.pyplot as plt
import numpy as np

API_URL = "http://localhost:8002"

def run_benchmark():
    """Run benchmark tests and collect timing data."""

    test_cases = [
        ("greeting", "Hello", "Приветствие"),
        ("help", "Help", "Справка"),
        ("statistics", "Statistics", "Статистика"),
        ("documents", "List documents", "Список документов"),
        ("search", "Search for love", "Поиск"),
        ("character", "Tell me about Hamlet", "Персонаж"),
        ("theme", "What is the theme of betrayal", "Тема"),
        ("author", "Who is the author", "Автор"),
        ("clear", "Clear history", "Очистка"),
    ]

    results = []

    print("=" * 60)
    print("БЕНЧМАРК ДИАЛОГОВОЙ СИСТЕМЫ")
    print("=" * 60)

    for intent_name, message, desc in test_cases:
        try:
            start = time.perf_counter()
            response = requests.post(
                f"{API_URL}/dialog",
                json={"message": message},
                timeout=30
            )
            elapsed = (time.perf_counter() - start) * 1000

            data = response.json()
            timing = data.get("timing", {})

            results.append({
                "name": desc,
                "message": message,
                "intent": data.get("intent"),
                "total_ms": timing.get("total_ms", elapsed),
                "intent_ms": timing.get("intent_classification_ms", 0),
                "entity_ms": timing.get("entity_extraction_ms", 0),
                "response_ms": timing.get("response_generation_ms", 0),
            })

            print(f"[{desc:15}] {intent_name:12} | {timing.get('total_ms', 0):>8.2f} мс")

        except Exception as e:
            print(f"[{desc:15}] ОШИБКА: {e}")

    return results


def create_chart(results, save_path="benchmark_chart.png"):
    """Create performance chart."""

    names = [r["name"] for r in results]
    total_times = [r["total_ms"] for r in results]

    fig, ax = plt.subplots(figsize=(12, 6))

    colors = plt.cm.Blues(np.linspace(0.4, 0.9, len(names)))

    bars = ax.bar(names, total_times, color=colors, edgecolor='navy', linewidth=1.2)

    for bar, val in zip(bars, total_times):
        ax.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 1,
                f'{val:.1f}', ha='center', va='bottom', fontsize=10, fontweight='bold')

    ax.set_xlabel('Тип запроса', fontsize=12, fontweight='bold')
    ax.set_ylabel('Время выполнения (мс)', fontsize=12, fontweight='bold')
    ax.set_title('Быстродействие диалоговой системы\n(время отклика по типам запросов)', fontsize=14, fontweight='bold')

    ax.grid(axis='y', alpha=0.3, linestyle='--')
    ax.set_ylim(0, max(total_times) * 1.2)

    plt.xticks(rotation=30, ha='right')
    plt.tight_layout()
    plt.savefig(save_path, dpi=150, bbox_inches='tight')
    print(f"\nГрафик сохранён: {save_path}")
    plt.close()


def create_detailed_chart(results, save_path="benchmark_detailed.png"):
    """Create detailed breakdown chart."""

    names = [r["name"] for r in results]

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

    plt.tight_layout()
    plt.savefig(save_path, dpi=150, bbox_inches='tight')
    print(f"Детализированный график сохранён: {save_path}")
    plt.close()


def print_summary(results):
    """Print benchmark summary."""

    total_times = [r["total_ms"] for r in results]

    print("\n" + "=" * 60)
    print("ИТОГИ БЕНЧМАРКА")
    print("=" * 60)
    print(f"Количество тестов: {len(results)}")
    print(f"Минимальное время:  {min(total_times):.2f} мс")
    print(f"Максимальное время: {max(total_times):.2f} мс")
    print(f"Среднее время:      {sum(total_times)/len(total_times):.2f} мс")
    print("=" * 60)

    print("\nТоп-3 самых быстрых запроса:")
    sorted_by_time = sorted(results, key=lambda x: x["total_ms"])
    for i, r in enumerate(sorted_by_time[:3], 1):
        print(f"  {i}. {r['name']}: {r['total_ms']:.2f} мс")

    print("\nТоп-3 самых медленных запроса:")
    for i, r in enumerate(sorted_by_time[-3:][::-1], 1):
        print(f"  {i}. {r['name']}: {r['total_ms']:.2f} мс")


if __name__ == "__main__":
    print("Запуск бенчмарка...")
    print("Убедитесь, что сервер запущен: python main.py")
    print()

    try:
        results = run_benchmark()
        print_summary(results)
        create_chart(results)
        create_detailed_chart(results)
    except requests.exceptions.ConnectionError:
        print("ОШИБКА: Не удалось подключиться к серверу.")
        print("Запустите сервер: python main.py")