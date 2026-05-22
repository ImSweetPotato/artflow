from skills.sketch2portrait.skill import Sketch2PortraitSkill
from skills.sketch2keyvisual.skill import Sketch2KeyVisualSkill
from skills.gptimage2.skill import GptImage2Skill
from skills.comfyui_pet_traveler.skill import ComfyUiPetTravelerSkill

_REGISTRY = {
    Sketch2PortraitSkill.skill_id(): Sketch2PortraitSkill,
    Sketch2KeyVisualSkill.skill_id(): Sketch2KeyVisualSkill,
    GptImage2Skill.skill_id(): GptImage2Skill,
    ComfyUiPetTravelerSkill.skill_id(): ComfyUiPetTravelerSkill,
}


def get_skill(skill_id: str):
    return _REGISTRY.get(skill_id)


def list_skills() -> list:
    return [
        {
            "id": cls.skill_id(),
            "name": cls.display_name(),
            "description": cls.description(),
            "input_schema": cls.input_schema(),
        }
        for cls in _REGISTRY.values()
    ]
