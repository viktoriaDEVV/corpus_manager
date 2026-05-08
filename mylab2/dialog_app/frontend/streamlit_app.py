import streamlit as st
import requests
import json

st.set_page_config(page_title="Literature Assistant", page_icon="📚", layout="wide")

API_URL = "http://localhost:8002"

if "chat_history" not in st.session_state:
    st.session_state.chat_history = [
        {"role": "assistant", "text": "Hello! I'm your literature assistant. I can answer questions about texts in your corpus, discuss characters, plot, themes, and more. What would you like to know?"}
    ]


st.title("Literature Assistant")
st.markdown("Chat with your literature corpus. Ask about characters, plots, themes, authors, and more!")


with st.sidebar:
    st.header("Settings")
    if st.button("Clear Chat History", use_container_width=True):
        st.session_state.chat_history = [
            {"role": "assistant", "text": "History cleared. Start a new conversation!"}
        ]
        st.rerun()
    
    st.divider()
    st.subheader("Intents Available:")
    intents_info = """
    • **analyze** - Analyze text
    • **statistics** - Corpus stats
    • **search** - Search corpus
    • **character** - Literary characters
    • **plot** - Story/narrative
    • **theme** - Themes and motifs
    • **author** - Author information
    • **quote** - Find quotes
    • **genre** - Genre information
    • **help** - Show commands
    • **clear** - Reset dialog
    """
    st.markdown(intents_info)
    
    st.divider()
    if st.button("Check API Status"):
        try:
            response = requests.get(f"{API_URL}/", timeout=5)
            if response.status_code == 200:
                st.success("API is running!")
            else:
                st.error("API returned error")
        except Exception as e:
            st.error(f"API unavailable: {e}")


col_main, col_side = st.columns([3, 1])

with col_main:
    st.subheader("Conversation")
    
    chat_container = st.container(height=500)
    with chat_container:
        for msg in st.session_state.chat_history:
            with st.chat_message(msg["role"]):
                st.markdown(msg["text"])
    
    if prompt := st.chat_input("Ask about literature..."):
        st.session_state.chat_history.append({"role": "user", "text": prompt})
        
        with st.chat_message("user"):
            st.markdown(prompt)
        
        with st.chat_message("assistant"):
            with st.spinner("Thinking..."):
                try:
                    response = requests.post(
                        f"{API_URL}/chat",
                        json={"message": prompt},
                        timeout=180
                    )
                    if response.status_code == 200:
                        result = response.json()
                        bot_response = result.get("response", "No response received")
                        st.markdown(bot_response)
                        st.session_state.chat_history.append({"role": "assistant", "text": bot_response})
                    else:
                        error_msg = f"Error: {response.status_code}"
                        st.error(error_msg)
                        st.session_state.chat_history.append({"role": "assistant", "text": error_msg})
                except requests.exceptions.Timeout:
                    timeout_msg = "Request timed out. The model might be loading or processing a large query."
                    st.error(timeout_msg)
                    st.session_state.chat_history.append({"role": "assistant", "text": timeout_msg})
                except Exception as e:
                    error_msg = f"Connection error: {str(e)}"
                    st.error(error_msg)
                    st.session_state.chat_history.append({"role": "assistant", "text": error_msg})

with col_side:
    st.subheader("Quick Actions")
    
    quick_queries = [
        "Who are the main characters?",
        "What is the plot about?",
        "What are the main themes?",
        "Who is the author?",
        "What genre is this?",
        "Show statistics"
    ]
    
    for query in quick_queries:
        if st.button(query, use_container_width=True):
            st.session_state.chat_history.append({"role": "user", "text": query})
            with st.chat_message("user"):
                st.markdown(query)
            
            with st.chat_message("assistant"):
                with st.spinner("Thinking..."):
                    try:
                        response = requests.post(
                            f"{API_URL}/chat",
                            json={"message": query},
                            timeout=60
                        )
                        if response.status_code == 200:
                            result = response.json()
                            bot_response = result.get("response", "No response received")
                            st.markdown(bot_response)
                            st.session_state.chat_history.append({"role": "assistant", "text": bot_response})
                        else:
                            error_msg = f"Error: {response.status_code}"
                            st.error(error_msg)
                    except Exception as e:
                        error_msg = f"Error: {str(e)}"
                        st.error(error_msg)
            
            st.rerun()

st.divider()
st.caption("💡 Tip: Ask specific questions about characters, plot points, themes, or quotes from the texts in your corpus.")