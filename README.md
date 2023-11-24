## Code Ticket System
The Code Ticket System built on Azle (DFINITY) facilitates efficient code ticket management. It provides a platform for tracking and managing code-related tasks and assignments.

## Features:
- **Ticket Creation: Create new code tickets to track and manage code-related tasks.**
- **Ticket Updates: Update existing code tickets as the author or assignee.**
- **Ticket Assignment: Assign tickets to team members for individual ownership and accountability.**
- **Ticket Status Updates: Update the status of tickets as they progress through various stages.**
- **Ticket Comments: Add comments to tickets to provide additional context and updates.**
- **Search Functionality: Search for tickets based on keywords, titles, or descriptions.**
- **Due Date Management: Set due dates for tickets to prioritize and manage workloads effectively.**

## Run Local Instance of Canister

```bash
npm run dfx_install
```

Start a local instance of the ICP Network:

```bash
dfx start --background --clean
```

Stop the replica:

```bash
dfx stop
```

Deploy canister locally:

```bash
npm install
dfx deploy
```