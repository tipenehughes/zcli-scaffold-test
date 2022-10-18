import React, { useEffect, useState } from "react";
import { handleError } from "../../lib/helpers";
import { ThemeProvider } from "@zendeskgarden/react-theming";
import { Theme } from "../../modules/Theme";
import { DEFAULT_LOCALE } from "../../lib/constants";

import I18n from "../../lib/i18n";
import ErrorBoundary from "../../modules/ErrorBoundary";
import Main from "../../modules/Main";

export default function TicketSidebar({ client }) {
	// Setting up state
	const [currentUser, setCurrentUser] = useState(null);
	const [locale, setLocale] = useState(null);
	const [ticketSubject, setTicketSubject] = useState(null);
	const [ticketId, setTicketId] = useState(null);

	// Fetching data from Zendesk API with useEffect to ensure only runs on initial render
	useEffect(() => {
		initTicketSidebar();
	}, []);

	const initTicketSidebar = async () => {
		let currentUser = null;
		let ticketSubject = "";
		let ticketId = null;

		client.on("app.registered", (appData) => {
			ticketId = appData.context.ticketId;
		});

		try {
			const [user, subject] = await Promise.all([
				client.get("currentUser"),
				client.get("ticket.subject"),
			]);

			currentUser = user.currentUser;
			ticketSubject = subject["ticket.subject"];
		} catch (e) {
			handleError(e);
		}

		const locale = currentUser ? currentUser.locale : DEFAULT_LOCALE;

		I18n.loadTranslations(locale);

		setCurrentUser(currentUser.name);
		setLocale(locale);
		setTicketSubject(ticketSubject);
		setTicketId(ticketId);
	};

	// Event handler for displaying modal
	const handleDisplayModal = () => {
		client
			.invoke("instances.create", {
				location: "modal",
				url: "https://www.zendesk.com/",
				size: {
					// optional
					width: "500px",
					height: "300px",
				},
			})
			.then(function (modalContext) {
				// The modal is on screen now
				const modalClient = client.instance(modalContext["instances.create"][0].instanceGuid);
				modalClient.on("modal.close", function () {
					// The modal has been closed
				});
			});
	};

	return (
		currentUser !== null && (
			<ErrorBoundary>
				<ThemeProvider theme={Theme}>
					<Main
						currentUser={currentUser}
						locale={locale}
						ticketSubject={ticketSubject}
						ticketId={ticketId}
						handleDisplayModal={handleDisplayModal}
					/>
				</ThemeProvider>
			</ErrorBoundary>
		)
	);
}
