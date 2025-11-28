# Contributing to Dots and Boxes Game

Thank you for your interest in contributing! This document provides guidelines and information for contributors.

## 🌟 How to Contribute

### Reporting Bugs

1. **Check existing issues** - Someone may have already reported it
2. **Create a new issue** with:
   - Clear title and description
   - Steps to reproduce
   - Expected vs actual behavior
   - Browser and OS information
   - Screenshots if applicable

### Suggesting Enhancements

1. **Open an issue** describing:
   - The enhancement idea
   - Why it would be useful
   - Possible implementation approach
   - Any mockups or examples

### Code Contributions

1. **Fork the repository**
2. **Create a feature branch**

   ```bash
   git checkout -b feature/your-feature-name
   ```

3. **Make your changes** following our coding standards
4. **Test thoroughly** across different browsers
5. **Commit with clear messages**

   ```bash
   git commit -m "Add: feature description"
   ```

6. **Push to your fork**

   ```bash
   git push origin feature/your-feature-name
   ```

7. **Open a Pull Request** with:
   - Clear description of changes
   - Reference to related issues
   - Screenshots/GIFs for visual changes

## 📋 Coding Standards

### JavaScript Style

- Use ES6+ features (const/let, arrow functions, classes)
- Follow camelCase for variables and functions
- Use PascalCase for classes
- Comment complex logic
- Keep functions focused and small

### Code Structure

```javascript
// Good: Clear, focused function
function calculateGridDimensions(aspectRatio, gridSize) {
    const cols = Math.ceil(Math.sqrt(gridSize * aspectRatio));
    const rows = Math.ceil(gridSize / cols);
    return { cols, rows };
}

// Avoid: Doing too much in one function
function doEverything() {
    // ... 200 lines of code
}
```

### Canvas Drawing

- Always clear canvas before redrawing
- Use `beginPath()` before drawing shapes
- Set styles before drawing
- Use `save()` and `restore()` for temporary state changes

### Event Handling

- Bind event handlers in constructor or setup
- Remove event listeners when cleaning up
- Use `passive: false` for touch events that prevent default

## 🧪 Testing Checklist

Before submitting a PR, verify:

- [ ] Works in Chrome, Firefox, Safari, and Edge
- [ ] Responsive on different screen sizes
- [ ] Touch interactions work on mobile devices
- [ ] No console errors or warnings
- [ ] Game logic functions correctly (scoring, turns, win detection)
- [ ] Animations are smooth (60fps)
- [ ] Code is well-commented
- [ ] No breaking changes to existing functionality

## 🎯 Priority Areas

We especially welcome contributions in these areas:

1. **AI Opponent** - Implementing computer player with difficulty levels
2. **Performance** - Optimizing for larger grids (50×50+)
3. **Accessibility** - Keyboard navigation, screen reader support
4. **Mobile Experience** - Better touch handling and UI
5. **Features** - Undo/redo, save/load, replays
6. **Documentation** - Tutorials, code examples, API docs

## 📁 File Organization

### game.js

- `DotsAndBoxesGame` class
- Canvas rendering logic
- Game state management
- Event handlers

### welcome.js

- Screen transitions
- Game initialization
- Settings management

### styles.css

- Responsive layouts
- Animations
- Theme styling

### index.html

- Page structure
- Screen templates
- Script loading order

## 🔍 Code Review Process

Pull requests will be reviewed for:

1. **Functionality** - Does it work as intended?
2. **Code Quality** - Is it readable and maintainable?
3. **Performance** - Does it impact game smoothness?
4. **Compatibility** - Works across browsers/devices?
5. **Documentation** - Are changes documented?

## 💬 Communication

- **Issues** - For bugs and feature requests
- **Discussions** - For questions and ideas
- **Pull Requests** - For code contributions

## 📚 Resources

### Game Development

- [HTML5 Canvas Tutorial](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial)
- [JavaScript Event Handling](https://developer.mozilla.org/en-US/docs/Web/Events)
- [Touch Events](https://developer.mozilla.org/en-US/docs/Web/API/Touch_events)

### Dots and Boxes Strategy

- [Wikipedia - Dots and Boxes](https://en.wikipedia.org/wiki/Dots_and_Boxes)
- [Game Theory Analysis](https://www.google.com/search?q=dots+and+boxes+strategy)

## 🙏 Recognition

Contributors will be:

- Listed in the README
- Credited in release notes
- Acknowledged in the project documentation

## ❓ Questions?

If you have questions about contributing, please:

1. Check existing documentation
2. Search closed issues
3. Open a new issue with the "question" label

---

Thank you for helping make this game better! 🎮✨
