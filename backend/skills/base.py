from abc import ABC, abstractmethod
from typing import Callable


class BaseSkill(ABC):

    @classmethod
    @abstractmethod
    def skill_id(cls) -> str:
        """Skill 唯一标识"""

    @classmethod
    @abstractmethod
    def display_name(cls) -> str:
        """显示名称"""

    @classmethod
    def description(cls) -> str:
        return ""

    @classmethod
    def input_schema(cls) -> dict:
        """JSON Schema，描述输入参数，用于前端表单渲染"""
        return {}

    @abstractmethod
    def execute(
        self,
        params: dict,
        on_progress: Callable[[int, str], None],
        runtime_context: dict | None = None,
    ) -> dict:
        """
        执行任务，返回结果 dict
        on_progress(percent, message) 用于上报进度
        """
