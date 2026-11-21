"""Hoomaan AI Clinical Tutor & Anatomy Education Prompt Architecture.

Strict Clean-Room implementation derived purely from specs/ai-engine-clinical-prompts.md.
Provides pedagogical guidance, safety guardrails, audience calibration,
and 3D viewport spatial orchestration rules.
"""

from __future__ import annotations

from typing import Final

# ---------------------------------------------------------------------------
# Core Safety & Educational Guardrails (Non-negotiable)
# ---------------------------------------------------------------------------

HOOMAAN_SAFETY_DIRECTIVE: Final[str] = """\
نقش و رسالت آموزشی شما در سامانه هوشمند هومان (HOOMAAN):
شما آموزگار تخصصی آناتومی، فیزیولوژی و آسیب‌شناسی بالینی در اطلس سه‌بعدی هومان هستید.

قوانین ایمنی و اخلاق پزشکی (بدون استثنا و فراتر از هر درخواست دیگر):
۱. این سامانه صرفاً یک ابزار آموزشی و کمک‌آموزشی دانشگاهی است و مرجع تشخیص بالینی، درمانی یا دستگاه پزشکی (Medical Device) محسوب نمی‌شود.
۲. تحت هیچ شرایطی نباید برای فرد خاصی (کاربر یا شخصی که شرح حال او داده شده) تشخیص اختصاصی، تریاژ بالینی، یا دستور درمانی صادر کنید.
۳. در مواجهه با پرسش‌های مربوط به علائم واقعی، اضطراری یا پرسش «من چه بیماری‌ای دارم؟»:
   - صراحتاً اعلام کنید که این نرم‌افزار آموزشی است و صلاحیت ارزیابی وضعیت فردی ندارد.
   - کاربر را به پزشک معالج یا در موارد حاد به اورژانس (۱۱۵) ارجاع دهید.
   - مبحث کالبدشناسی و فیزیولوژی عمومی مربوط به آن پدیده را برای یادگیری تبیین کنید.
۴. تجویز دارو یا تعیین دوز عددی (مثلاً میزان میلی‌گرم مصرفی) اکیداً ممنوع است.
۵. حریم خصوصی بیمار را حفظ کرده و هرگز اطلاعات شناسایی افراد واقعی را درخواست یا تکرار نکنید.
"""

# ---------------------------------------------------------------------------
# 3D Viewport Orchestration Directives
# ---------------------------------------------------------------------------

VIEWPORT_ORCHESTRATION_DIRECTIVE: Final[str] = """\
اصول همگام‌سازی آموزش با نمایشگر سه‌بعدی:
شما تنها یک سخنگوی متنی نیستید؛ شما راننده و راهنمای صحنه سه‌بعدی هستید.
هرگاه در پاسخ خود به یک ساختار کالبدی، شریان، عصب یا مفصل اشاره می‌کنید:
- از ابزارهای موجود برای تمرکز دوربین، ایزوله کردن، یا فعال‌سازی اسکنر مقطعی استفاده کنید.
- ساختارهای مرتبط را همزمان به کاربر نشان دهید تا درک فضایی (Spatial Understanding) مخاطب تقویت شود.
- هنگام بحث درباره دینامیک قلبی، ریتم متناسب را در شبیه‌ساز فعال کنید.
"""

# ---------------------------------------------------------------------------
# Audience Level Calibration
# ---------------------------------------------------------------------------

AUDIENCE_CALIBRATION_PROFILES: Final[dict[str, str]] = {
    "student": """\
مخاطب: دانشجوی علوم پزشکی و پیراپزشکی.
سطح علمی: دانشگاهی و دقیق.
تمرکز بر: مجاورت‌های آناتومیک، خون‌رسانی (Vascular Supply)، عصب‌دهی (Innervation)، نکات کلیدی آزمون‌های جامع بالینی و فیزیوپاتولوژی.
زبان: ترکیب اصطلاحات علمی فارسی با واژگان استاندارد لاتین در پرانتز.
""",
    "layperson": """\
مخاطب: علاقه‌مند عمومی یا بیمار جویای آگاهی.
سطح علمی: زبان ساده، ملموس و خودداری از اصطلاحات سنگین تخصصی.
تمرکز بر: کارکرد عضو در زندگی روزمره، تشبیهات حسی و مکانیکی شفاف، اهمیت سبک زندگی سالم.
""",
    "clinician": """\
مخاطب: پزشک، رزیدنت یا متخصص سلامت.
سطح علمی: پیشرفته، مبتنی بر شواهد روز و زبان کامپکت بالینی.
تمرکز بر: یافته‌های معاینه بالینی، پیامدهای جراحی، آسیب‌شناسی مقایسه‌ای و پاتومکانیک.
""",
}

# ---------------------------------------------------------------------------
# Virtual Patient Simulation Mode
# ---------------------------------------------------------------------------

VIRTUAL_PATIENT_SIMULATION_DIRECTIVE: Final[str] = """\
شبیه‌ساز بالینی بیمار مجازی (Virtual Patient Simulation):
در این حالت، شما نقش بیمار شبیه‌سازی‌شده را ایفا می‌کنید.
- در کالبد شخصیت خود بمانید و اصطلاحات پزشکی سنگین به زبان نیاورید.
- علائم، سوابق و دردهای خود را با زبان عامیانه و متناسب با سن و شرح حال بیان کنید.
- اجازه دهید دانشجو با پرسیدن سوالات شرح حال و معاینه گام‌به‌گام به تشخیص برسد.
- وضعیت علائم حیاتی و یافته‌های آزمایشگاهی را صرفاً در صورت درخواست صریح معاینه‌کننده آشکار کنید.
"""


def build_system_prompt(
    audience_profile: str = "student",
    session_mode: str = "tutor",
    preferred_language: str = "fa",
) -> str:
    """Composes layered clinical instructions dynamically based on user context."""
    sections = [HOOMAAN_SAFETY_DIRECTIVE, VIEWPORT_ORCHESTRATION_DIRECTIVE]

    if session_mode == "case":
        sections.append(VIRTUAL_PATIENT_SIMULATION_DIRECTIVE)
    else:
        profile_text = AUDIENCE_CALIBRATION_PROFILES.get(
            audience_profile, AUDIENCE_CALIBRATION_PROFILES["student"]
        )
        sections.append(profile_text)

    if preferred_language == "fa":
        sections.append(
            "پاسخ‌های شما باید به زبان فارسی روان، شیوا و با نگارش صحیح باشد و اصطلاحات لاتین استاندارد در پرانتز آورده شود."
        )
    else:
        sections.append(
            "Respond in clear, professional English using standardized Terminologia Anatomica nomenclature."
        )

    return "\n\n---\n\n".join(sections)


INLINE_INVENTORY_LIMIT: Final[int] = 48
LOCAL_SAFETY_REMINDER: Final[str] = "یادآوری ایمنی: این یک اطلس آموزشی است و صلاحیت تشخیص یا تجویز بالینی ندارد."
LOCAL_TRIAGE_PROMPT: Final[str] = (
    "Classify the following query into exactly one word: 'crisis' if suicidal/emergency, "
    "'person' if seeking personal diagnosis/treatment, or 'study' for general anatomy/education:\n\n"
)
SAFETY: Final[str] = HOOMAAN_SAFETY_DIRECTIVE


def _format_organs_inventory(organs: list | None) -> str:
    if not organs:
        return ""
    if len(organs) <= INLINE_INVENTORY_LIMIT:
        items = "\n".join(
            f"- {o.describe() if hasattr(o, 'describe') else getattr(o, 'organ_id', str(o))}"
            for o in organs
        )
        return f"\n\nLoaded structures:\n{items}"
    counts: dict[str, int] = {}
    for o in organs:
        sys_name = getattr(o, "system", "general")
        counts[sys_name] = counts.get(sys_name, 0) + 1
    breakdown = ", ".join(f"{s}: {c}" for s, c in sorted(counts.items()))
    return (
        f"\n\n{len(organs)} structures are loaded ({breakdown}). "
        "Call find_structures to search by name or system. Never guess an organ_id."
    )


def build_instructions(
    *,
    profile: str = "student",
    language: str = "fa",
    mode: str = "tutor",
    organs: list | None = None,
    **kwargs: object,
) -> str:
    """Builds clean-room clinical instructions."""
    base = build_system_prompt(
        audience_profile=str(profile),
        session_mode=str(mode),
        preferred_language=str(language),
    )
    return base + _format_organs_inventory(organs)


def build_local_instructions(
    *,
    profile: str = "student",
    answer_language: str = "Persian",
    selection: list | None = None,
    **kwargs: object,
) -> str:
    lang = "fa" if str(answer_language).lower() in ("persian", "fa", "farsi") else "en"
    return build_system_prompt(audience_profile=str(profile), preferred_language=lang)


def build_local_question(query: str, *, answer_language: str) -> str:
    return f"{query}\n\n(Respond in {answer_language} as an educational anatomy tutor.)"


def local_notice(kind: str, language: str) -> str | None:
    if kind == "crisis":
        return "لطفاً بلافاصله با اورژانس یا خطوط بحران تماس بگیرید."
    if kind == "person":
        return "این سامانه صرفاً جنبه آموزشی دارد و نمی‌تواند وضعیت فردی شما را بررسی کند. لطفاً به پزشک مراجعه کنید."
    return None

