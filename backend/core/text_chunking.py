"""
Text chunking service with multiple methodologies for RAG applications.

Supported chunking methods:
- fixed_size: Split text into fixed-size chunks with overlap
- sentence: Split text by sentences with configurable grouping
- paragraph: Split text by paragraphs
- semantic: Split text at semantic boundaries (sentences that end topics)
- recursive: Recursively split using multiple separators (LangChain-style)
"""

import re
import logging
from typing import List, Dict, Any, Optional
from dataclasses import dataclass
from enum import Enum

logger = logging.getLogger(__name__)


class ChunkingMethod(str, Enum):
    """Available chunking methodologies"""
    FIXED_SIZE = "fixed_size"
    SENTENCE = "sentence"
    PARAGRAPH = "paragraph"
    SEMANTIC = "semantic"
    RECURSIVE = "recursive"


@dataclass
class Chunk:
    """Represents a text chunk with metadata"""
    content: str
    index: int
    start_char: int
    end_char: int
    metadata: Dict[str, Any]


class TextChunker:
    """Service for chunking text documents using various methodologies"""
    
    # Default configurations for each method
    DEFAULT_CONFIGS = {
        ChunkingMethod.FIXED_SIZE: {
            "chunk_size": 512,
            "chunk_overlap": 50
        },
        ChunkingMethod.SENTENCE: {
            "sentences_per_chunk": 5,
            "overlap_sentences": 1
        },
        ChunkingMethod.PARAGRAPH: {
            "min_paragraph_length": 100,
            "combine_short_paragraphs": True
        },
        ChunkingMethod.SEMANTIC: {
            "max_chunk_size": 1000,
            "min_chunk_size": 100
        },
        ChunkingMethod.RECURSIVE: {
            "chunk_size": 512,
            "chunk_overlap": 50,
            "separators": ["\n\n", "\n", ". ", " ", ""]
        }
    }
    
    def __init__(self):
        self._init_nltk()
    
    def _init_nltk(self):
        """Initialize NLTK resources for sentence tokenization"""
        try:
            import nltk
            try:
                nltk.data.find('tokenizers/punkt')
            except LookupError:
                logger.info("Downloading NLTK punkt tokenizer...")
                nltk.download('punkt', quiet=True)
            try:
                nltk.data.find('tokenizers/punkt_tab')
            except LookupError:
                logger.info("Downloading NLTK punkt_tab tokenizer...")
                nltk.download('punkt_tab', quiet=True)
        except Exception as e:
            logger.warning(f"Failed to initialize NLTK: {e}")
    
    def chunk(
        self, 
        text: str, 
        method: ChunkingMethod = ChunkingMethod.RECURSIVE,
        config: Optional[Dict[str, Any]] = None
    ) -> List[Chunk]:
        """
        Chunk text using the specified method.
        
        Args:
            text: The text to chunk
            method: The chunking method to use
            config: Optional configuration overrides for the method
            
        Returns:
            List of Chunk objects
        """
        if not text or not text.strip():
            return []
        
        # Merge default config with provided config
        method_config = self.DEFAULT_CONFIGS.get(method, {}).copy()
        if config:
            method_config.update(config)
        
        # Call appropriate chunking method
        if method == ChunkingMethod.FIXED_SIZE:
            return self._chunk_fixed_size(text, method_config)
        elif method == ChunkingMethod.SENTENCE:
            return self._chunk_by_sentence(text, method_config)
        elif method == ChunkingMethod.PARAGRAPH:
            return self._chunk_by_paragraph(text, method_config)
        elif method == ChunkingMethod.SEMANTIC:
            return self._chunk_semantic(text, method_config)
        elif method == ChunkingMethod.RECURSIVE:
            return self._chunk_recursive(text, method_config)
        else:
            logger.warning(f"Unknown chunking method: {method}, falling back to recursive")
            return self._chunk_recursive(text, self.DEFAULT_CONFIGS[ChunkingMethod.RECURSIVE])
    
    def _chunk_fixed_size(self, text: str, config: Dict[str, Any]) -> List[Chunk]:
        """Split text into fixed-size chunks with overlap"""
        chunk_size = config.get("chunk_size", 512)
        overlap = config.get("chunk_overlap", 50)
        
        chunks = []
        start = 0
        index = 0
        
        while start < len(text):
            end = start + chunk_size
            chunk_text = text[start:end]
            
            # Try to break at word boundary
            if end < len(text) and not text[end].isspace():
                last_space = chunk_text.rfind(' ')
                if last_space > chunk_size * 0.5:  # Only break if we have at least half the chunk
                    end = start + last_space
                    chunk_text = text[start:end]
            
            chunk_text = chunk_text.strip()
            if chunk_text:
                chunks.append(Chunk(
                    content=chunk_text,
                    index=index,
                    start_char=start,
                    end_char=end,
                    metadata={"method": "fixed_size", "chunk_size": chunk_size}
                ))
                index += 1
            
            start = end - overlap
            if start >= len(text):
                break
        
        return chunks
    
    def _chunk_by_sentence(self, text: str, config: Dict[str, Any]) -> List[Chunk]:
        """Split text by sentences with configurable grouping"""
        sentences_per_chunk = config.get("sentences_per_chunk", 5)
        overlap_sentences = config.get("overlap_sentences", 1)
        
        # Try to use NLTK for sentence tokenization
        try:
            import nltk
            sentences = nltk.sent_tokenize(text)
        except Exception:
            # Fallback to simple regex-based sentence splitting
            sentences = re.split(r'(?<=[.!?])\s+', text)
        
        chunks = []
        index = 0
        i = 0
        
        while i < len(sentences):
            chunk_sentences = sentences[i:i + sentences_per_chunk]
            chunk_text = ' '.join(chunk_sentences).strip()
            
            if chunk_text:
                # Calculate character positions
                start_char = text.find(chunk_sentences[0]) if chunk_sentences else 0
                end_char = start_char + len(chunk_text)
                
                chunks.append(Chunk(
                    content=chunk_text,
                    index=index,
                    start_char=start_char,
                    end_char=end_char,
                    metadata={
                        "method": "sentence",
                        "sentences_count": len(chunk_sentences)
                    }
                ))
                index += 1
            
            i += sentences_per_chunk - overlap_sentences
        
        return chunks
    
    def _chunk_by_paragraph(self, text: str, config: Dict[str, Any]) -> List[Chunk]:
        """Split text by paragraphs"""
        min_length = config.get("min_paragraph_length", 100)
        combine_short = config.get("combine_short_paragraphs", True)
        
        # Split by double newlines (paragraphs)
        raw_paragraphs = re.split(r'\n\s*\n', text)
        
        chunks = []
        current_chunk = ""
        current_start = 0
        index = 0
        char_pos = 0
        
        for para in raw_paragraphs:
            para = para.strip()
            if not para:
                char_pos += 2  # Account for the split characters
                continue
            
            if combine_short and len(current_chunk) + len(para) < min_length:
                if current_chunk:
                    current_chunk += "\n\n" + para
                else:
                    current_chunk = para
                    current_start = char_pos
            else:
                # Save current chunk if exists
                if current_chunk:
                    chunks.append(Chunk(
                        content=current_chunk,
                        index=index,
                        start_char=current_start,
                        end_char=current_start + len(current_chunk),
                        metadata={"method": "paragraph"}
                    ))
                    index += 1
                
                current_chunk = para
                current_start = char_pos
            
            char_pos += len(para) + 2  # +2 for paragraph separator
        
        # Don't forget the last chunk
        if current_chunk:
            chunks.append(Chunk(
                content=current_chunk,
                index=index,
                start_char=current_start,
                end_char=current_start + len(current_chunk),
                metadata={"method": "paragraph"}
            ))
        
        return chunks
    
    def _chunk_semantic(self, text: str, config: Dict[str, Any]) -> List[Chunk]:
        """
        Split text at semantic boundaries.
        Uses sentence endings that likely indicate topic changes.
        """
        max_chunk_size = config.get("max_chunk_size", 1000)
        min_chunk_size = config.get("min_chunk_size", 100)
        
        # Get sentences
        try:
            import nltk
            sentences = nltk.sent_tokenize(text)
        except Exception:
            sentences = re.split(r'(?<=[.!?])\s+', text)
        
        # Semantic boundary indicators
        boundary_patterns = [
            r'^(However|Nevertheless|Furthermore|Moreover|In conclusion|Therefore|Thus|Finally|Consequently|As a result)',
            r'^(First|Second|Third|Next|Then|Lastly|Additionally)',
            r'^(On the other hand|In contrast|Alternatively|Meanwhile)',
            r'^(In summary|To summarize|Overall|In short)',
            r'^\d+\.',  # Numbered lists
            r'^[-•*]',  # Bullet points
        ]
        
        chunks = []
        current_chunk = ""
        current_start = 0
        index = 0
        char_pos = 0
        
        for sentence in sentences:
            sentence = sentence.strip()
            if not sentence:
                continue
            
            # Check if this sentence is a semantic boundary
            is_boundary = any(re.match(pattern, sentence, re.IGNORECASE) for pattern in boundary_patterns)
            
            # Check if we should start a new chunk
            should_split = (
                is_boundary and len(current_chunk) >= min_chunk_size
            ) or len(current_chunk) + len(sentence) > max_chunk_size
            
            if should_split and current_chunk:
                chunks.append(Chunk(
                    content=current_chunk.strip(),
                    index=index,
                    start_char=current_start,
                    end_char=current_start + len(current_chunk),
                    metadata={"method": "semantic"}
                ))
                index += 1
                current_chunk = sentence
                current_start = char_pos
            else:
                if current_chunk:
                    current_chunk += " " + sentence
                else:
                    current_chunk = sentence
                    current_start = char_pos
            
            char_pos += len(sentence) + 1
        
        # Add the last chunk
        if current_chunk:
            chunks.append(Chunk(
                content=current_chunk.strip(),
                index=index,
                start_char=current_start,
                end_char=current_start + len(current_chunk),
                metadata={"method": "semantic"}
            ))
        
        return chunks
    
    def _chunk_recursive(self, text: str, config: Dict[str, Any]) -> List[Chunk]:
        """
        Recursively split text using multiple separators.
        This is similar to LangChain's RecursiveCharacterTextSplitter.
        """
        chunk_size = config.get("chunk_size", 512)
        chunk_overlap = config.get("chunk_overlap", 50)
        separators = config.get("separators", ["\n\n", "\n", ". ", " ", ""])
        
        def split_text(text: str, separators: List[str]) -> List[str]:
            """Recursively split text using the list of separators"""
            if not separators:
                return [text]
            
            separator = separators[0]
            remaining_separators = separators[1:]
            
            if separator == "":
                # Base case: split by character
                return list(text)
            
            splits = text.split(separator)
            
            result = []
            for split in splits:
                if len(split) <= chunk_size:
                    if split.strip():
                        result.append(split)
                else:
                    # Recursively split with next separator
                    result.extend(split_text(split, remaining_separators))
            
            return result
        
        # Get initial splits
        splits = split_text(text, separators)
        
        # Merge splits into chunks respecting size limits
        chunks = []
        current_chunk = ""
        current_start = 0
        index = 0
        char_pos = 0
        
        for split in splits:
            split = split.strip()
            if not split:
                continue
            
            test_chunk = current_chunk + (" " if current_chunk else "") + split
            
            if len(test_chunk) <= chunk_size:
                if not current_chunk:
                    current_start = char_pos
                current_chunk = test_chunk
            else:
                # Save current chunk
                if current_chunk:
                    chunks.append(Chunk(
                        content=current_chunk,
                        index=index,
                        start_char=current_start,
                        end_char=current_start + len(current_chunk),
                        metadata={"method": "recursive"}
                    ))
                    index += 1
                    
                    # Handle overlap
                    if chunk_overlap > 0:
                        # Find overlap text from the end of current chunk
                        words = current_chunk.split()
                        overlap_words = []
                        overlap_len = 0
                        for word in reversed(words):
                            if overlap_len + len(word) + 1 <= chunk_overlap:
                                overlap_words.insert(0, word)
                                overlap_len += len(word) + 1
                            else:
                                break
                        current_chunk = " ".join(overlap_words) + " " + split if overlap_words else split
                    else:
                        current_chunk = split
                    current_start = char_pos
                else:
                    current_chunk = split
                    current_start = char_pos
            
            char_pos += len(split) + 1
        
        # Add the last chunk
        if current_chunk:
            chunks.append(Chunk(
                content=current_chunk,
                index=index,
                start_char=current_start,
                end_char=current_start + len(current_chunk),
                metadata={"method": "recursive"}
            ))
        
        return chunks
    
    @staticmethod
    def get_available_methods() -> List[Dict[str, Any]]:
        """Get list of available chunking methods with descriptions"""
        return [
            {
                "id": ChunkingMethod.RECURSIVE.value,
                "name": "Recursive (Recommended)",
                "description": "Splits text hierarchically using multiple separators (paragraphs → sentences → words). Best for general use.",
                "default_config": TextChunker.DEFAULT_CONFIGS[ChunkingMethod.RECURSIVE]
            },
            {
                "id": ChunkingMethod.SEMANTIC.value,
                "name": "Semantic",
                "description": "Splits at natural topic boundaries by detecting transition phrases. Good for articles and essays.",
                "default_config": TextChunker.DEFAULT_CONFIGS[ChunkingMethod.SEMANTIC]
            },
            {
                "id": ChunkingMethod.SENTENCE.value,
                "name": "Sentence-based",
                "description": "Groups sentences together. Ideal for documents where sentence boundaries are meaningful.",
                "default_config": TextChunker.DEFAULT_CONFIGS[ChunkingMethod.SENTENCE]
            },
            {
                "id": ChunkingMethod.PARAGRAPH.value,
                "name": "Paragraph-based",
                "description": "Splits by paragraphs, combining short ones. Best for well-structured documents.",
                "default_config": TextChunker.DEFAULT_CONFIGS[ChunkingMethod.PARAGRAPH]
            },
            {
                "id": ChunkingMethod.FIXED_SIZE.value,
                "name": "Fixed Size",
                "description": "Splits into fixed character chunks with overlap. Simple but less context-aware.",
                "default_config": TextChunker.DEFAULT_CONFIGS[ChunkingMethod.FIXED_SIZE]
            }
        ]
