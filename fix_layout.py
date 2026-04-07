import sys

with open('src/components/service/components/WorkOrderModal.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

old_scrollable = '''          {/* Scrollable Content */}
          <div className="px-4 py-5 md:px-6 md:py-6 space-y-6 overflow-y-auto flex-1 pb-24 md:pb-6">'''

new_scrollable = '''          {/* Main Content Area Layout */}
          <div className="flex flex-col lg:flex-row flex-1 overflow-hidden">
            {/* Left Column (Scrollable Form) */}
            <div className="flex-1 overflow-y-auto px-4 py-5 md:px-6 md:py-6 space-y-6 lg:border-r border-slate-200 dark:border-slate-700 pb-24 lg:pb-6 bg-white dark:bg-slate-800 lg:pr-8">'''

text = text.replace(old_scrollable, new_scrollable)

with open('src/components/service/components/WorkOrderModal.tsx', 'w', encoding='utf-8') as f:
    f.write(text)
